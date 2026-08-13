import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | undefined;
let loggerProvider: LoggerProvider | undefined;
let telemetryEnabled = false;

function getSentryOtlpEndpoint(dsn: string): { endpoint: string; sentryAuth: string } {
    const url = new URL(dsn);
    const projectId = url.pathname.split('/').filter(Boolean).pop();

    if (!projectId) {
        throw new Error('Invalid SENTRY_DSN: missing project id');
    }

    return {
        // Preserve regional hosts such as o123.ingest.us.sentry.io.
        endpoint: `https://${url.hostname}/api/${projectId}/integration/otlp`,
        sentryAuth: `sentry sentry_key=${url.username}, sentry_version=7`,
    };
}

function toError(error: unknown): Error {
    if (error instanceof Error) {
        return error;
    }

    if (typeof error === 'string') {
        return new Error(error);
    }

    return new Error('Unknown error');
}

export function initTelemetry(serviceName: string, version = '1.0.0', sentryDsn?: string, tracesSampleRate = 1): void {
    if (!sentryDsn) return;
    const { endpoint, sentryAuth } = getSentryOtlpEndpoint(sentryDsn);

    sdk = new NodeSDK({
        resource: resourceFromAttributes({
            [ATTR_SERVICE_NAME]: serviceName,
            [ATTR_SERVICE_VERSION]: version,
        }),
        sampler: new ParentBasedSampler({
            root: new TraceIdRatioBasedSampler(tracesSampleRate),
        }),
        traceExporter: new OTLPTraceExporter({
            url: `${endpoint}/v1/traces`,
            headers: {
                'x-sentry-auth': sentryAuth,
            },
        }),
        metricReader: new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter({
                url: `${endpoint}/v1/metrics`,
                headers: {
                    'x-sentry-auth': sentryAuth,
                },
            }),
            exportIntervalMillis: 15_000,
        }),
        instrumentations: [
            getNodeAutoInstrumentations({
                '@opentelemetry/instrumentation-fs': { enabled: false },
            }),
        ],
    });

    loggerProvider = new LoggerProvider({
        resource: resourceFromAttributes({
            [ATTR_SERVICE_NAME]: serviceName,
            [ATTR_SERVICE_VERSION]: version,
        }),
        processors: [
            new BatchLogRecordProcessor({
                exporter: new OTLPLogExporter({
                    url: `${endpoint}/v1/logs`,
                    headers: {
                        'x-sentry-auth': sentryAuth,
                    },
                }),
            }),
        ],
    });

    logs.setGlobalLoggerProvider(loggerProvider);

    sdk.start();
    telemetryEnabled = true;
}

export function logServerStarted(host: string, port: number): void {
    if (!telemetryEnabled) return;

    const logger = logs.getLogger('fast-pdf.server');
    logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'server.started',
        attributes: {
            'event.name': 'server.started',
            'server.host': host,
            'server.port': port,
        },
    });
}

export function logUnhandledException(error: unknown, attributes: Record<string, string | number | boolean> = {}): void {
    if (!telemetryEnabled) return;

    const normalized = toError(error);
    const activeSpan = trace.getActiveSpan();

    if (activeSpan) {
        activeSpan.recordException(normalized);
        activeSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: normalized.message,
        });
    }

    const logger = logs.getLogger('fast-pdf.server');
    logger.emit({
        severityNumber: SeverityNumber.ERROR,
        severityText: 'ERROR',
        body: normalized.message,
        attributes: {
            'event.name': 'exception',
            'exception.type': normalized.name,
            'exception.message': normalized.message,
            'exception.stacktrace': normalized.stack ?? '',
            ...attributes,
        },
    });
}

export async function shutdownTelemetry(): Promise<void> {
    if (sdk) {
        await sdk.shutdown();
    }

    if (loggerProvider) {
        await loggerProvider.shutdown();
    }
}
