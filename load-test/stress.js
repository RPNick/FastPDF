/**
 * FastPDF — k6 stress test
 *
 * Modes:
 *   1) Capacity mode (default): expects mostly 200s
 *   2) Rate-limit-aware mode: expects many 429s and tracks 5xx separately
 *
 * Usage:
 *   k6 run -e BASE_URL=http://localhost:2626 -e AUTH_PASSWORD=yourpassword load-test/stress.js
 *
 * Use HTML fixtures from a folder:
 *   k6 run -e BASE_URL=http://localhost:2626 -e AUTH_PASSWORD=yourpassword \
 *     -e HTML_FIXTURES_DIR=./scripts/html \
 *     -e HTML_FIXTURE_FILES=apex-report-finance.html,apex-report-operations.html,apex-report-sales.html \
 *     load-test/stress.js
 *
 * Rate-limit-aware usage:
 *   k6 run -e BASE_URL=http://localhost:2626 -e AUTH_PASSWORD=yourpassword -e RATE_LIMIT_AWARE=true load-test/stress.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

const renderDuration = new Trend('pdf_render_duration', true);
const renderErrors = new Counter('pdf_render_errors');
const renderSuccess = new Rate('pdf_render_success_rate');

const status200Rate = new Rate('status_200_rate');
const status429Rate = new Rate('status_429_rate');
const status5xxRate = new Rate('status_5xx_rate');

const rateLimitedCount = new Counter('rate_limited_count');
const serverErrorCount = new Counter('server_error_count');
const status200Count = new Counter('status_200_count');
const status400Count = new Counter('status_400_count');
const status401Count = new Counter('status_401_count');
const status403Count = new Counter('status_403_count');
const status404Count = new Counter('status_404_count');
const status413Count = new Counter('status_413_count');
const status429Count = new Counter('status_429_count');
const status500Count = new Counter('status_500_count');
const status502Count = new Counter('status_502_count');
const status503Count = new Counter('status_503_count');
const status504Count = new Counter('status_504_count');
const statusOtherCount = new Counter('status_other_count');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:2626';
const PASSWORD = __ENV.AUTH_PASSWORD;
const RATE_LIMIT_AWARE = String(__ENV.RATE_LIMIT_AWARE || 'false').toLowerCase() === 'true';
const HTML_FIXTURES_DIR = (__ENV.HTML_FIXTURES_DIR || '').trim();
const HTML_FIXTURE_FILES = (__ENV.HTML_FIXTURE_FILES || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
const MAX_VUS = Number(__ENV.STRESS_MAX_VUS || 30);
const RAMP_UP = __ENV.STRESS_RAMP_UP || '1m';
const HOLD_1 = __ENV.STRESS_HOLD_1 || '2m';
const HOLD_2 = __ENV.STRESS_HOLD_2 || '2m';
const RAMP_DOWN = __ENV.STRESS_RAMP_DOWN || '1m';

const TARGET_1 = Math.max(1, Math.round(MAX_VUS / 3));
const TARGET_2 = Math.max(TARGET_1, Math.round((MAX_VUS * 2) / 3));

let non200SamplesLogged = 0;

if (!PASSWORD) {
    throw new Error('AUTH_PASSWORD env var is required. Pass with -e AUTH_PASSWORD=...');
}

const HTML_FIXTURE = `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"></head>
  <body style="padding:40px">
    <h1>Stress Test Document #VU_PLACEHOLDER</h1>
    <p>This document is generated during stress testing to measure peak throughput.</p>
  </body>
</html>`;

function resolveFixturePath(filePath) {
    if (!HTML_FIXTURES_DIR || filePath.startsWith('/')) {
        return filePath;
    }

    const dir = HTML_FIXTURES_DIR.replace(/\/+$/, '');
    return `${dir}/${filePath}`;
}

function fixturePathCandidates(entry) {
    const basePath = resolveFixturePath(entry);
    const candidates = [basePath];

    // k6 resolves open() paths relative to this script location (load-test/).
    // Also try project-root-relative form when users pass paths like ./scripts/html/....
    if (!basePath.startsWith('/') && !basePath.startsWith('../')) {
        candidates.push(`../${basePath}`);
    }

    return candidates;
}

function openFirstAvailable(entry) {
    const candidates = fixturePathCandidates(entry);
    let lastError = '';

    for (const candidate of candidates) {
        try {
            return open(candidate);
        } catch (error) {
            lastError = String(error);
        }
    }

    throw new Error(
        `Failed to load HTML fixture: ${entry}. Tried ${candidates.join(', ')}. ${lastError}`,
    );
}

function loadHtmlTemplates() {
    if (HTML_FIXTURE_FILES.length === 0) {
        return [HTML_FIXTURE];
    }

    return HTML_FIXTURE_FILES.map((entry) => openFirstAvailable(entry));
}

function materializeHtml(template, marker) {
    const withMarker = template
        .replace(/VU_PLACEHOLDER/g, marker)
        .replace(/\{\{VU\}\}/g, marker);

    if (withMarker !== template) {
        return withMarker;
    }

    return `${template}\n<!-- k6-doc-id:${marker} -->`;
}

function getHeaderValue(headers, headerName) {
    if (!headers) {
        return '';
    }

    const direct = headers[headerName];
    if (typeof direct === 'string') {
        return direct;
    }

    const lower = headers[headerName.toLowerCase()];
    if (typeof lower === 'string') {
        return lower;
    }

    const upper = headers[headerName.toUpperCase()];
    if (typeof upper === 'string') {
        return upper;
    }

    return '';
}

const HTML_TEMPLATES = loadHtmlTemplates();

if (HTML_FIXTURE_FILES.length > 0) {
    console.log(`Loaded ${HTML_TEMPLATES.length} HTML fixture(s) for stress run.`);
}

export const options = {
    scenarios: {
        stress: {
            executor: 'ramping-vus',
            startVUs: 1,
            stages: [
                { duration: RAMP_UP, target: TARGET_1 },
                { duration: HOLD_1, target: TARGET_2 },
                { duration: HOLD_2, target: MAX_VUS },
                { duration: RAMP_DOWN, target: 0 },
            ],
        },
    },
    thresholds: RATE_LIMIT_AWARE
        ? {
            pdf_render_duration: ['p(95)<26260'],
            status_429_rate: ['rate>0.70'],
            status_5xx_rate: ['rate<0.01'],
            http_req_failed: ['rate<0.99'],
        }
        : {
            pdf_render_duration: ['p(95)<26260'],
            pdf_render_success_rate: ['rate>0.90'],
            http_req_failed: ['rate<0.10'],
            status_429_rate: ['rate<0.05'],
            status_5xx_rate: ['rate<0.01'],
        },
};

export function setup() {
    const res = http.post(
        `${BASE_URL}/authenticate`,
        JSON.stringify({ password: PASSWORD }),
        { headers: { 'Content-Type': 'application/json' } },
    );
    check(res, { 'setup: auth 200': (r) => r.status === 200 });
    const token = res.json('token');
    if (!token) throw new Error(`Authentication failed — status ${res.status}`);
    return { token };
}

export default function (data) {
    const marker = String(__VU * 1000 + __ITER);
    const template = HTML_TEMPLATES[(__VU + __ITER) % HTML_TEMPLATES.length];
    const html = materializeHtml(template, marker);
    const start = Date.now();

    const res = http.post(
        `${BASE_URL}/pdf-render`,
        JSON.stringify({ html, filename: `test-vu${__VU}-iter${__ITER}` }),
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${data.token}`,
            },
            // Keep response as text so non-200 JSON error bodies can be sampled.
            responseType: 'text',
            timeout: '60s',
        },
    );

    renderDuration.add(Date.now() - start);

    const is200 = res.status === 200;
    const is429 = res.status === 429;
    const is5xx = res.status >= 500 && res.status < 600;

    status200Rate.add(is200 ? 1 : 0);
    status429Rate.add(is429 ? 1 : 0);
    status5xxRate.add(is5xx ? 1 : 0);

    switch (res.status) {
        case 200:
            status200Count.add(1);
            break;
        case 400:
            status400Count.add(1);
            break;
        case 401:
            status401Count.add(1);
            break;
        case 403:
            status403Count.add(1);
            break;
        case 404:
            status404Count.add(1);
            break;
        case 413:
            status413Count.add(1);
            break;
        case 429:
            status429Count.add(1);
            break;
        case 500:
            status500Count.add(1);
            break;
        case 502:
            status502Count.add(1);
            break;
        case 503:
            status503Count.add(1);
            break;
        case 504:
            status504Count.add(1);
            break;
        default:
            statusOtherCount.add(1);
            break;
    }

    if (is429) rateLimitedCount.add(1);
    if (is5xx) serverErrorCount.add(1);

    if (!is200 && __VU === 1 && non200SamplesLogged < 20) {
        const requestId = getHeaderValue(res.headers, 'x-request-id') || 'n/a';
        const body = typeof res.body === 'string' ? res.body.slice(0, 500) : '[non-text response body]';
        non200SamplesLogged += 1;
        console.error(`NON200_SAMPLE #${non200SamplesLogged} status=${res.status} requestId=${requestId} body=${body}`);
    }

    const ok = check(res, {
        'render: status 200': (r) => r.status === 200,
        'render: content-type pdf (for 200)': (r) =>
            r.status !== 200 || getHeaderValue(r.headers, 'content-type').includes('application/pdf'),
        'render: rate-limited in aware mode': (r) =>
            !RATE_LIMIT_AWARE || r.status === 200 || r.status === 429,
    });

    renderSuccess.add(is200 ? 1 : 0);
    if (!ok) renderErrors.add(1);

    sleep(0.5);
}