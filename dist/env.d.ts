import { z } from 'zod';
declare const EnvSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<{
        development: "development";
        production: "production";
        test: "test";
    }>>;
    PORT: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    HOST: z.ZodDefault<z.ZodString>;
    LOG_LEVEL: z.ZodDefault<z.ZodEnum<{
        error: "error";
        info: "info";
        debug: "debug";
        fatal: "fatal";
        warn: "warn";
        trace: "trace";
    }>>;
    AUTH_PASSWORD: z.ZodString;
    JWT_SECRET: z.ZodString;
    JWT_EXPIRES_IN: z.ZodDefault<z.ZodString>;
    MAX_HTML_SIZE: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    PUPPETEER_EXECUTABLE_PATH: z.ZodOptional<z.ZodString>;
    OTEL_EXPORTER_OTLP_ENDPOINT: z.ZodOptional<z.ZodString>;
    OTEL_SERVICE_NAME: z.ZodDefault<z.ZodString>;
    SENTRY_DSN: z.ZodOptional<z.ZodString>;
    SENTRY_TRACES_SAMPLE_RATE: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    RATE_LIMIT_MAX: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    RATE_LIMIT_WINDOW_MS: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    CONCURRENT_RENDERS: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type Env = z.infer<typeof EnvSchema>;
export declare function validateEnv(): Env;
export {};
//# sourceMappingURL=env.d.ts.map