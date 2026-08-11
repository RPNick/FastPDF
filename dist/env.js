"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnv = validateEnv;
const zod_1 = require("zod");
const EnvSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    PORT: zod_1.z.coerce.number().int().positive().default(2626),
    HOST: zod_1.z.string().default('0.0.0.0'),
    LOG_LEVEL: zod_1.z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    AUTH_PASSWORD: zod_1.z.string().min(16, 'AUTH_PASSWORD must be at least 16 characters'),
    JWT_SECRET: zod_1.z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: zod_1.z.string().default('1d'),
    MAX_HTML_SIZE: zod_1.z.coerce.number().int().positive().default(5 * 1024 * 1024),
    PUPPETEER_EXECUTABLE_PATH: zod_1.z.string().optional(),
    OTEL_EXPORTER_OTLP_ENDPOINT: zod_1.z.string().url().optional(),
    OTEL_SERVICE_NAME: zod_1.z.string().default('fastpdf'),
    SENTRY_DSN: zod_1.z.string().url().optional(),
    SENTRY_TRACES_SAMPLE_RATE: zod_1.z.coerce.number().min(0).max(1).default(1.0),
    RATE_LIMIT_MAX: zod_1.z.coerce.number().int().positive().default(60),
    RATE_LIMIT_WINDOW_MS: zod_1.z.coerce.number().int().positive().default(60000),
    CONCURRENT_RENDERS: zod_1.z.coerce.number().int().min(1).max(50).default(5),
});
function validateEnv() {
    const result = EnvSchema.safeParse(process.env);
    if (!result.success) {
        console.error('Invalid environment configuration — server will not start:');
        for (const issue of result.error.issues) {
            console.error(`  ${issue.path.join('.')}: ${issue.message}`);
        }
        process.exit(1);
    }
    return result.data;
}
//# sourceMappingURL=env.js.map