
import dotenv from 'dotenv';
dotenv.config();

import { validateEnv } from './env';
import { initTelemetry, shutdownTelemetry } from './telemetry';
import { setupApp } from './app';

const env = validateEnv();
initTelemetry(env.OTEL_SERVICE_NAME, '1.0.0', env.SENTRY_DSN);

async function start() {
    const app = await setupApp(env);

    process.on('SIGTERM', async () => {
        await app.close();
        await shutdownTelemetry();
    });

    await app.listen({ port: env.PORT, host: env.HOST });
}

start().catch((error) => {
    console.error(error);
    process.exit(1);
});