#!/usr/bin/env bash
# Run the three load-test scenarios required by the assignment:
#   A. single   — frontend Deployment scaled to 1 replica
#   B. replicated — frontend scaled to 3 replicas
#   C. chaos    — 3 replicas, one pod force-deleted mid-test
#
# Usage:
#   BASE_URL=http://<frontend-or-ingress-host>[:port] ./run-scenarios.sh
#
# Requires: kubectl pointing at a cluster with prlab manifests applied, k6 in PATH.

set -euo pipefail

NAMESPACE="${NAMESPACE:-prlab}"
DEPLOY="${DEPLOY:-frontend}"
BASE_URL="${BASE_URL:-}"

if [[ -z "${BASE_URL}" ]]; then
  echo "ERROR: set BASE_URL (e.g. BASE_URL=http://localhost:8080 ./run-scenarios.sh)" >&2
  exit 1
fi

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
  echo ">>> running scenario: ${scenario}"
  BASE_URL="${BASE_URL}" SCENARIO="${scenario}" k6 run load.js
}

# Scenario A — single replica
scale_and_wait 1
run_k6 single

# Scenario B — three replicas
scale_and_wait 3
run_k6 replicated

# Scenario C — three replicas + chaos (kill one pod ~10s into the run)
scale_and_wait 3
echo ">>> starting scenario: chaos (will kill one pod after 10s)"
( BASE_URL="${BASE_URL}" SCENARIO=chaos k6 run load.js ) &
K6_PID=$!

sleep 10
VICTIM="$(kubectl -n "${NAMESPACE}" get pods -l "app=${DEPLOY}" -o jsonpath='{.items[0].metadata.name}')"
echo ">>> force-deleting pod: ${VICTIM}"
kubectl -n "${NAMESPACE}" delete pod "${VICTIM}" --grace-period=0 --force

wait "${K6_PID}"

echo
echo "=== All scenarios complete. JSON summaries in results/ ==="
ls -1 results/
