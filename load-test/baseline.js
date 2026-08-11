/**
 * FastPDF — k6 baseline load test
 *
 * Usage:
 *   k6 run -e BASE_URL=http://localhost:2626 -e AUTH_PASSWORD=yourpassword load-test/baseline.js
 *
 * Outputs a JSON summary when run with:
 *   k6 run --out json=load-test/runs/$(date +%Y%m%d-%H%M%S).json ...
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

// ── Custom metrics ──────────────────────────────────────────────────────────
const renderDuration = new Trend('pdf_render_duration', true);
const renderErrors = new Counter('pdf_render_errors');
const renderSuccess = new Rate('pdf_render_success_rate');

// ── Config ──────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:2626';
const PASSWORD = __ENV.AUTH_PASSWORD;

if (!PASSWORD) {
    throw new Error('AUTH_PASSWORD env var is required. Pass with -e AUTH_PASSWORD=...');
}

const HTML_FIXTURE = `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>Load Test Invoice</title></head>
  <body style="font-family: sans-serif; padding: 40px;">
    <h1>Invoice #VU_PLACEHOLDER</h1>
    <table border="1" cellpadding="8" style="border-collapse:collapse;width:100%">
      <thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead>
      <tbody>
        <tr><td>Widget A</td><td>2</td><td>$10.00</td></tr>
        <tr><td>Widget B</td><td>5</td><td>$4.50</td></tr>
        <tr><td>Widget C</td><td>1</td><td>$99.00</td></tr>
      </tbody>
    </table>
    <p style="margin-top:20px">Total: $141.50</p>
  </body>
</html>`;

// ── Scenario: ramping baseline ───────────────────────────────────────────────
export const options = {
    scenarios: {
        baseline: {
            executor: 'ramping-vus',
            startVUs: 1,
            stages: [
                { duration: '30s', target: 3 },   // warm up
                { duration: '1m', target: 5 },   // sustain
                { duration: '30s', target: 0 },   // ramp down
            ],
        },
    },
    thresholds: {
        pdf_render_duration: ['p(95)<15000'],  // 95th percentile < 15 s
        pdf_render_success_rate: ['rate>0.99'],    // > 99 % success
        http_req_failed: ['rate<0.01'],    // < 1 % HTTP errors
    },
};

// ── Setup: authenticate once and share the token across VUs ─────────────────
export function setup() {
    const res = http.post(
        `${BASE_URL}/authenticate`,
        JSON.stringify({ password: PASSWORD }),
        { headers: { 'Content-Type': 'application/json' } },
    );
    check(res, { 'setup: auth 200': (r) => r.status === 200 });
    const token = res.json('token');
    if (!token) throw new Error(`Authentication failed — status ${res.status}: ${res.body}`);
    return { token };
}

// ── Default function: render one PDF per iteration ───────────────────────────
export default function (data) {
    const html = HTML_FIXTURE.replace('VU_PLACEHOLDER', String(__VU * 1000 + __ITER));
    const start = Date.now();

    const res = http.post(
        `${BASE_URL}/pdf-render`,
        JSON.stringify({ html, filename: `test-vu${__VU}-iter${__ITER}` }),
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${data.token}`,
            },
            responseType: 'binary',
        },
    );

    const elapsed = Date.now() - start;
    renderDuration.add(elapsed);

    const ok = check(res, {
        'render: status 200': (r) => r.status === 200,
        'render: content-type pdf': (r) => (r.headers['Content-Type'] || '').includes('application/pdf'),
        'render: non-empty payload': (r) => {
            if (r.body && typeof r.body === 'object' && 'byteLength' in r.body) {
                return r.body.byteLength > 500;
            }
            if (typeof r.body === 'string') {
                return r.body.length > 500;
            }
            return false;
        },
        'render: x-request-id present': (r) => !!r.headers['X-Request-Id'],
    });

    renderSuccess.add(ok ? 1 : 0);
    if (!ok) renderErrors.add(1);

    sleep(1);
}
