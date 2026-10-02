// Carma API load test (k6: https://k6.io). Simulates people opening the app:
// account, garages, vehicles, notifications, a vehicle timeline.
//
//   BASE_URL=https://api.example.com TOKENS=tok1,tok2,... k6 run loadtest/api.k6.js
//
// TOKENS: access tokens for test accounts (one per simulated person is best;
// each account is rate-limited separately). Mint them on a staging server
// only. GARAGE_ID / VEHICLE_ID: ids those accounts can read.
// Ramp: to 200 virtual users over 2 minutes, hold 5 minutes, ramp down.
// Fails the run if p95 latency > 500 ms or more than 1% of requests fail.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:4000';
const TOKENS = (__ENV.TOKENS || '').split(',').filter(Boolean);
const GARAGE = __ENV.GARAGE_ID;
const VEHICLE = __ENV.VEHICLE_ID;

export const options = {
  scenarios: {
    open_app: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: Number(__ENV.PEAK_VUS || 200) },
        { duration: '5m', target: Number(__ENV.PEAK_VUS || 200) },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  if (TOKENS.length === 0) throw new Error('Set TOKENS to one or more access tokens.');
  const headers = { Authorization: `Bearer ${TOKENS[(__VU - 1) % TOKENS.length]}` };
  const get = (path) => http.get(`${BASE}/api/v1/${path}`, { headers, tags: { name: path.split('?')[0].replace(/[0-9a-z-]{20,}/g, ':id') } });

  const responses = [get('account'), get('garages'), get('notifications?pageSize=100')];
  if (GARAGE) responses.push(get(`vehicles?garageId=${GARAGE}&pageSize=100`), get(`garages/${GARAGE}/members`));
  if (VEHICLE) responses.push(get(`vehicles/${VEHICLE}/timeline?pageSize=50`));
  for (const r of responses) check(r, { 'status 200': (res) => res.status === 200 });

  sleep(1 + Math.random() * 4); // think time between screens
}
