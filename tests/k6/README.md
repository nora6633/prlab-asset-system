# K6 load tests

對應作業要求的三場景效能比較：

| 場景 | 設定 | 觀察重點 |
| --- | --- | --- |
| `single` | frontend `replicas: 1` | baseline，單一前端的吞吐 / 延遲 |
| `replicated` | frontend `replicas: 3` | 多副本 + Service LB 後的吞吐應更高、p95 更低 |
| `chaos` | `replicas: 3`，測試中強刪一個 pod | 觀察錯誤率有無暴衝 / Deployment 自動補位後是否恢復 |

## 設定

- `load.js` — 50 VUs × 30s 打 `GET /`，輸出 `results/<scenario>.json`
- `run-scenarios.sh` — 自動跑完三場景（需要 kubectl 指向已部署 manifests 的 K8s cluster）
- thresholds：`http_req_failed < 5%`、`p(95) < 1000ms`（chaos 場景容忍些許失敗）

## 快速 smoke test（不需要 K8s）

確認腳本本身能跑：

```bash
cd tests/k6
docker compose -f ../../docker-compose.yml up -d   # 確認 frontend 在 :8080
BASE_URL=http://localhost:8081 SCENARIO=smoke k6 run load.js
```

結果會寫到 `results/smoke.json`。

## 三場景比較結果 → [RESULTS.md](./RESULTS.md)

## 完整三場景（需要 K8s）

> **不要用 `run-scenarios.sh` 配 `kubectl port-forward`** — kubectl 的 port-forward 只 tunnel 到單一 backing pod，不走 Service LB，三場景數據會幾乎一樣。
> 用下面的 `run-scenarios-in-cluster.sh` 把 K6 跑在 cluster 內、透過 service DNS 才能真實看到 LB 效果。



### 1. 起 K8s cluster

選一個：

```bash
# Docker Desktop：到設定 → Kubernetes → Enable
# 或 minikube
minikube start --cpus=4 --memory=4096

# 或 kind
kind create cluster --name prlab
```

### 2. 部署 manifests

```bash
kubectl apply -f k8s/secrets.yaml           # 含 namespace + Secret（記得改真實密碼）
kubectl apply -f k8s/postgres-statefulset.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml

# 等三個都 Ready
kubectl -n prlab get pods -w
```

### 3. 取得 frontend 對外位址

最簡單：port-forward Service。

```bash
kubectl -n prlab port-forward svc/frontend 8081:80
# 另開一個 terminal 跑測試
```

也可以改用 NodePort / Ingress。Ingress 路徑記得對 frontend Service。

### 4. 把 load.js 推進 cluster + 跑三場景

```bash
kubectl -n prlab create configmap k6-load \
  --from-file=load.js=tests/k6/load.js \
  --dry-run=client -o yaml | kubectl apply -f -

cd tests/k6
./run-scenarios-in-cluster.sh
```

腳本會：
1. `kubectl scale frontend --replicas=1`，等 rollout 完，跑 K6 Job → `results/single.k8s.txt`
2. 縮放到 `--replicas=3`，跑 K6 Job → `results/replicated.k8s.txt`
3. 縮放到 `--replicas=3`，K6 Job 開始後第 10 秒 `kubectl delete pod --force` 砍一個，跑完 → `results/chaos.k8s.txt`

### 5. 比較結果

每場跑完 K6 會印 summary（reqs/s、avg、p95、p99、失敗率）。也可以從 `results/*.json` 抽指標：

```bash
for s in single replicated chaos; do
  jq -r --arg s "$s" '
    "[\($s)] reqs=\(.metrics.http_reqs.values.count) " +
    "rps=\(.metrics.http_reqs.values.rate|tostring|.[0:6]) " +
    "p95=\(.metrics.http_req_duration.values["p(95)"]|tostring|.[0:6])ms " +
    "fail=\((.metrics.http_req_failed.values.rate*100)|tostring|.[0:5])%"
  ' "results/$s.json"
done
```

Demo 影片中把這三組數字呈現出來，並解釋：
- 為什麼 `replicated` 吞吐高 / 延遲低（Service `iptables` 把流量分到 3 個 Pod）
- 為什麼 `chaos` 在殺 pod 那幾秒仍可服務（Service endpoint 立即剔除壞 pod、ReplicaSet controller 補位）
