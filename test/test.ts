import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { setupApp } from '../src/app';
import { validateEnv } from '../src/env';

dotenv.config();

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.AUTH_PASSWORD = process.env.AUTH_PASSWORD && process.env.AUTH_PASSWORD.length >= 16
    ? process.env.AUTH_PASSWORD
    : 'test-password-at-least-16-chars';
process.env.JWT_SECRET = process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32
    ? process.env.JWT_SECRET
    : 'test-secret-at-least-32-characters-here';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';
process.env.MAX_HTML_SIZE = process.env.MAX_HTML_SIZE || '5242880';
process.env.CONCURRENT_RENDERS = process.env.CONCURRENT_RENDERS || '5';
process.env.RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX || '60';
process.env.RATE_LIMIT_WINDOW_MS = process.env.RATE_LIMIT_WINDOW_MS || '60000';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'info';
process.env.PORT = process.env.PORT || '2626';
process.env.HOST = process.env.HOST || '0.0.0.0';

const env = validateEnv();

// ── helpers ────────────────────────────────────────────────────────────────

async function getToken(app: Awaited<ReturnType<typeof setupApp>>): Promise<string> {
    const res = await app.inject({
        method: 'POST',
        url: '/authenticate',
        payload: { password: env.AUTH_PASSWORD },
    });
    const body = res.json<{ token: string }>();
    return body.token;
}

const MINIMAL_HTML = '<html><body><h1>Test</h1></body></html>';

// ── tests ──────────────────────────────────────────────────────────────────

test('Health check returns 200 with status ok', async (t) => {
    const app = await setupApp(env);
    t.after(() => app.close());

    const res = await app.inject({ method: 'GET', url: '/health' });
    assert.strictEqual(res.statusCode, 200);
    const body = res.json<{ status: string }>();
    assert.strictEqual(body.status, 'ok');
});

test('Health response includes x-request-id header', async (t) => {
    const app = await setupApp(env);
    t.after(() => app.close());

    const res = await app.inject({ method: 'GET', url: '/health' });
    assert.ok(res.headers['x-request-id'], 'x-request-id header should be present');
});

test('Auth — valid password returns JWT', async (t) => {
    const app = await setupApp(env);
    t.after(() => app.close());

    const res = await app.inject({
        method: 'POST',
        url: '/authenticate',
        payload: { password: env.AUTH_PASSWORD },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = res.json<{ success: boolean; token: string; tokenType: string }>();
    assert.strictEqual(body.success, true);
    assert.ok(body.token, 'token should be present');
    assert.strictEqual(body.tokenType, 'Bearer');
});

test('Auth — wrong password returns 401', async (t) => {
    const app = await setupApp(env);
    t.after(() => app.close());

    const res = await app.inject({
        method: 'POST',
        url: '/authenticate',
        payload: { password: 'definitely-wrong-password' },
    });
    assert.strictEqual(res.statusCode, 401);
    const body = res.json<{ success: boolean }>();
    assert.strictEqual(body.success, false);
});

test('Auth — missing password field returns 400', async (t) => {
    const app = await setupApp(env);
    t.after(() => app.close());

    const res = await app.inject({
        method: 'POST',
        url: '/authenticate',
        payload: {},
    });
    assert.strictEqual(res.statusCode, 400);
});

test('PDF render — no token returns 401', async (t) => {
    const app = await setupApp(env);
    t.after(() => app.close());

    const res = await app.inject({
        method: 'POST',
        url: '/pdf-render',
        payload: { html: MINIMAL_HTML },
    });
    assert.strictEqual(res.statusCode, 401);
});

test('PDF render — invalid token returns 401', async (t) => {
    const app = await setupApp(env);
    t.after(() => app.close());

    const res = await app.inject({
        method: 'POST',
        url: '/pdf-render',
        headers: { authorization: 'Bearer not.a.valid.jwt' },
        payload: { html: MINIMAL_HTML },
    });
    assert.strictEqual(res.statusCode, 401);
});

test('PDF render — valid token returns PDF binary', async (t) => {
    const app = await setupApp(env);
    t.after(() => app.close());

    const token = await getToken(app);
    const res = await app.inject({
        method: 'POST',
        url: '/pdf-render',
        headers: { authorization: `Bearer ${token}` },
        payload: { html: MINIMAL_HTML, filename: 'test-output' },
    });
    assert.strictEqual(res.statusCode, 200);
    const contentType = String(res.headers['content-type'] ?? '');
    assert.ok(contentType.includes('application/pdf'), 'content-type should be pdf');
    assert.ok(res.headers['content-disposition']?.includes('test-output.pdf'));
    assert.ok(res.rawPayload.length > 100, 'PDF payload should be non-trivial');
});

test('PDF render — oversized body returns 413', async (t) => {
    const oversizedEnv = { ...env, MAX_HTML_SIZE: 1024 };
    const app = await setupApp(oversizedEnv);
    t.after(() => app.close());

    const token = await getToken(app);
    const res = await app.inject({
        method: 'POST',
        url: '/pdf-render',
        headers: { authorization: `Bearer ${token}` },
        payload: { html: '<html><body>' + 'x'.repeat(2048) + '</body></html>' },
    });

    assert.strictEqual(res.statusCode, 413);
});

test('PDF render — missing html field returns 400', async (t) => {
    const app = await setupApp(env);
    t.after(() => app.close());

    const token = await getToken(app);
    const res = await app.inject({
        method: 'POST',
        url: '/pdf-render',
        headers: { authorization: `Bearer ${token}` },
        payload: {},
    });
    assert.strictEqual(res.statusCode, 400);
    const body = res.json<{ success: boolean; error: string }>();
    assert.strictEqual(body.success, false);
});

test('404 for unknown route', async (t) => {
    const app = await setupApp(env);
    t.after(() => app.close());

    const res = await app.inject({ method: 'GET', url: '/not-a-route' });
    assert.strictEqual(res.statusCode, 404);
});

