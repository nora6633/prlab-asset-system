#!/usr/bin/env bash
# Run K6 from INSIDE the cluster so requests go through the Service's
# kube-proxy load balancer (kubectl port-forward only hits one pod).
#
# Usage:  ./run-scenarios-in-cluster.sh
# Requires: kubectl context pointing at the cluster with prlab manifests + k6-load ConfigMap.

set -euo pipefail

NAMESPACE="${NAMESPACE:-prlab}"
DEPLOY="${DEPLOY:-frontend}"
BASE_URL="${BASE_URL:-http://frontend}"

cd "$(dirname "$0")"
mkdir -p results

scale_and_wait() {
  local n="$1"
  echo ">>> scaling ${DEPLOY} to ${n} replica(s)"
  kubectl -n "${NAMESPACE}" scale "deployment/${DEPLOY}" "--replicas=${n}"
  kubectl -n "${NAMESPACE}" rollout status "deployment/${DEPLOY}" --timeout=120s
  sleep 3
}

run_k6() {
  local scenario="$1"
  local job="k6-${scenario}"
  echo ">>> running scenario: ${scenario}" >&2
  kubectl -n "${NAMESPACE}" delete job "${job}" --ignore-not-found=true --wait=true >/dev/null 2>&1
  kubectl -n "${NAMESPACE}" apply -f - >&2 <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: ${job}
spec:
  ttlSecondsAfterFinished: 600
  backoffLimit: 0
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: k6
          image: grafana/k6:0.57.0
          args: ["run", "/scripts/load.js"]
          env:
            - name: BASE_URL
              value: "${BASE_URL}"
            - name: SCENARIO
              value: "${scenario}"
          volumeMounts:
            - name: script
              mountPath: /scripts
      volumes:
        - name: script
          configMap:
            name: k6-load
EOF
  echo "${job}"
}

wait_job() {
  local job="$1"
  kubectl -n "${NAMESPACE}" wait --for=condition=complete "job/${job}" --timeout=120s
}

save_logs() {
  local scenario="$1"
  local job="$2"
  kubectl -n "${NAMESPACE}" logs "job/${job}" > "results/${scenario}.k8s.txt"
  echo ">>> saved results/${scenario}.k8s.txt"
}

# Scenario A — single replica
scale_and_wait 1
JOB=$(run_k6 single)
wait_job "${JOB}"
save_logs single "${JOB}"

# Scenario B — three replicas
scale_and_wait 3
JOB=$(run_k6 replicated)
wait_job "${JOB}"
save_logs replicated "${JOB}"

# Scenario C — three replicas + chaos
scale_and_wait 3
JOB=$(run_k6 chaos)

# kill one pod ~10s in
sleep 10
VICTIM=$(kubectl -n "${NAMESPACE}" get pods -l "app=${DEPLOY}" -o jsonpath='{.items[0].metadata.name}')
echo ">>> force-deleting pod: ${VICTIM}"
kubectl -n "${NAMESPACE}" delete pod "${VICTIM}" --grace-period=0 --force >/dev/null 2>&1

wait_job "${JOB}"
save_logs chaos "${JOB}"

echo
echo "=== All scenarios complete. Logs in results/*.k8s.txt ==="
ls -1 results/*.k8s.txt
