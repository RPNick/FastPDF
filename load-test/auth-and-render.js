/**
 * FastPDF — k6 auth + PDF render smoke test
 *
 * Usage:
 *   k6 run -e BASE_URL=http://localhost:2626 -e AUTH_PASSWORD=yourpassword load-test/auth-and-render.js
 *
 * Use HTML fixtures from a folder:
 *   k6 run -e BASE_URL=http://localhost:2626 -e AUTH_PASSWORD=yourpassword \
 *     -e HTML_FIXTURES_DIR=./scripts/html \
 *     -e HTML_FIXTURE_FILES=apex-report-finance.html,apex-report-operations.html,apex-report-sales.html \
 *     load-test/auth-and-render.js
 *
 * JSON report:
 *   k6 run --out json=load-test/runs/$(date +%Y%m%d-%H%M%S).json load-test/auth-and-render.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { loadHtmlTemplates, materializeHtml } from './shared.js';

const renderDuration = new Trend('pdf_render_duration', true);
const renderErrors = new Counter('pdf_render_errors');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:2626';
const PASSWORD = __ENV.AUTH_PASSWORD;
const HTML_FIXTURES_DIR = (__ENV.HTML_FIXTURES_DIR || '').trim();
const HTML_FIXTURE_FILES = (__ENV.HTML_FIXTURE_FILES || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

if (!PASSWORD) {
    throw new Error('AUTH_PASSWORD env var is required. Pass with -e AUTH_PASSWORD=...');
}

const HTML_FIXTURE = `<!DOCTYPE html><html><body>
  <h1>Invoice #{{VU}}</h1>
  <p>Generated at ${new Date().toISOString()}</p>
</body></html>`;

const HTML_TEMPLATES = loadHtmlTemplates(HTML_FIXTURE, HTML_FIXTURE_FILES, HTML_FIXTURES_DIR);

if (HTML_FIXTURE_FILES.length > 0) {
    console.log(`Loaded ${HTML_TEMPLATES.length} HTML fixture(s) for auth-and-render run.`);
}

export const options = {
    scenarios: {
        baseline: {
            executor: 'ramping-vus',
            startVUs: 1,
            stages: [
                { duration: '30s', target: 5 },
                { duration: '1m', target: 10 },
                { duration: '30s', target: 0 },
            ],
        },
    },
    thresholds: {
        pdf_render_duration: ['p(95)<10000'],
        pdf_render_errors: ['count<5'],
        http_req_failed: ['rate<0.01'],
    },
};

export function setup() {
    const res = http.post(
        `${BASE_URL}/authenticate`,
        JSON.stringify({ password: PASSWORD }),
        { headers: { 'Content-Type': 'application/json' } },
    );
    check(res, { 'auth ok': (r) => r.status === 200 });
    const token = res.json('token');
    if (!token) throw new Error(`Authentication failed — status ${res.status}: ${res.body}`);
    return { token };
}

export default function (data) {
    const template = HTML_TEMPLATES[(__VU + __ITER) % HTML_TEMPLATES.length];
    const html = materializeHtml(template, String(__VU * 1000 + __ITER));
    const start = Date.now();
    const res = http.post(
        `${BASE_URL}/pdf-render`,
        JSON.stringify({ html, filename: 'test.pdf' }),
        {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${data.token}`,
            },
            responseType: 'binary',
        },
    );

    renderDuration.add(Date.now() - start);

    const ok = check(res, {
        'render status 200': (r) => r.status === 200,
        'content-type is pdf': (r) => (r.headers['Content-Type'] || '').includes('application/pdf'),
        'response non-empty': (r) => r.body.length > 1000,
    });

    if (!ok) renderErrors.add(1);

    sleep(1);
}
