import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8081";
const SCENARIO = __ENV.SCENARIO || "smoke";

export const options = {
  stages: [
    { duration: "5s", target: 50 },
    { duration: "25s", target: 50 },
    { duration: "5s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<1000"],
  },
  tags: { scenario: SCENARIO },
  summaryTrendStats: ["avg", "med", "p(95)", "p(99)", "max"],
};

export default function () {
  const res = http.get(`${BASE_URL}/`);
  check(res, { "status 200": (r) => r.status === 200 });
  sleep(0.1);
}

export function handleSummary(data) {
  return {
    [`results/${SCENARIO}.json`]: JSON.stringify(data),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  const m = data.metrics;
  const dur = m.http_req_duration.values;
  const failed = m.http_req_failed.values;
  return `
=== Scenario: ${SCENARIO} ===
  http_reqs:         ${m.http_reqs.values.count} (${m.http_reqs.values.rate.toFixed(1)} req/s)
  http_req_duration: avg=${dur.avg.toFixed(1)}ms  med=${dur.med.toFixed(1)}ms  p95=${dur["p(95)"].toFixed(1)}ms  p99=${dur["p(99)"].toFixed(1)}ms  max=${dur.max.toFixed(1)}ms
  http_req_failed:   ${(failed.rate * 100).toFixed(2)}%
  vus_max:           ${m.vus_max.values.max}
`;
}
