# K6 三場景效能比較結果

執行環境：
- Cluster：Docker Desktop K8s v1.34.3（單節點）
- Frontend：`prlab/frontend:latest`（nginx:1.29-alpine + Vite build），ClusterIP Service
- Load：50 VUs，30s constant load，`GET /`（透過 cluster 內 Service DNS `http://frontend`）
- K6：v0.57.0，跑在 `grafana/k6:0.57.0` Job 內，確保走 Service 的 kube-proxy LB

## 結果

| 場景 | replicas | 動作 | reqs | RPS | avg | p95 | p99 | max | fail |
|---|:---:|---|---:|---:|---:|---:|---:|---:|---:|
| **single** | 1 | baseline | 14,562 | 415.3 | 1.6ms | 5.6ms | 12.1ms | 25.2ms | 0.00% |
| **replicated** | 3 | LB 分散 | 14,661 | 418.4 | **1.2ms** | **3.7ms** | 8.3ms | 15.4ms | 0.00% |
| **chaos** | 3 | t+10s 強刪 1 pod | 14,634 | 417.7 | 1.3ms | 3.7ms | 12.0ms | 27.7ms | **0.03%** |

原始 K6 文字輸出在 [`results/{single,replicated,chaos}.k8s.log`](./results/)。

## 解讀

**single → replicated**
- `p95` 由 5.6ms 降到 3.7ms（**改善 34%**）、`avg` 由 1.6ms 降到 1.2ms
- RPS 看起來沒變，是因為 client 端 50 VUs + `sleep(0.1)` 已經 cap 在 ~500 RPS，frontend 完全沒飽和
- 證實 Service `kube-proxy iptables` 模式有把連線均分到 3 個 Pod（如果都打到同一個 pod，延遲應該跟 single 一樣）

**replicated → chaos**
- 期間用 `kubectl delete pod --grace-period=0 --force` 強砍其中一個 Pod
- 50 個 VU 不間斷打請求，總共只有 **4 個請求失敗（0.03%）**
- p95 / p99 / 吞吐都沒明顯惡化
- 證實兩個機制起作用：
  1. **Endpoints controller** 偵測到 Pod NotReady → Service endpoint slice 立刻把它移除
  2. **ReplicaSet controller** 在 ~3s 內補一個新 Pod，繼續維持 desired state = 3

## 為什麼不能用 `kubectl port-forward` 來測

我們最初的 `run-scenarios.sh` 是從本機跑 K6，透過 `kubectl port-forward svc/frontend 8081:80` 進 cluster — 跑出來三場景數據幾乎一模一樣（都 ~412 RPS，p95 ~8.5ms）。原因：

> `kubectl port-forward svc/...` 會選一個（單一）backing pod 直接 tunnel，**不會走 Service iptables LB**。
> 這是 kubectl 已知限制（[issue #15180](https://github.com/kubernetes/kubernetes/issues/15180)）。

所以從本機打 port-forward 永遠看不出 replicas 的效果。`run-scenarios-in-cluster.sh` 把 K6 變成 cluster 內的 Job、用 service DNS `http://frontend` 才能真實測到 LB。

## 重跑指令

```bash
# 1. 確認 cluster 有 prlab namespace + manifests applied
kubectl -n prlab get pods

# 2. 把 load.js 推進 cluster
kubectl -n prlab create configmap k6-load \
  --from-file=load.js=tests/k6/load.js \
  --dry-run=client -o yaml | kubectl apply -f -

# 3. 跑三場景
cd tests/k6
./run-scenarios-in-cluster.sh

# 4. 看結果
ls -1 results/*.k8s.log
```
