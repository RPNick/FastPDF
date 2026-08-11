import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | undefined;

export function initTelemetry(serviceName: string, version = '1.0.0', sentryDsn?: string): void {
    if (!sentryDsn) return;

    // Sentry OTLP endpoint: https://o<org>.ingest.sentry.io/api/<project>/integration/otlp
    // Requires sentry-trace header for trace context propagation
    const url = new URL(sentryDsn);
    const orgId = url.hostname.split('.')[0].replace('o', '');
    const projectId = url.pathname.split('/').pop();
    const sentryOtlpEndpoint = `https://o${orgId}.ingest.sentry.io/api/${projectId}/integration/otlp`;

    sdk = new NodeSDK({
        resource: resourceFromAttributes({
            [ATTR_SERVICE_NAME]: serviceName,
            [ATTR_SERVICE_VERSION]: version,
        }),
        traceExporter: new OTLPTraceExporter({
            url: `${sentryOtlpEndpoint}/v1/traces`,
            headers: {
                'x-sentry-auth': `sentry sentry_key=${url.username}, sentry_version=7`,
            },
        }),
        metricReader: new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter({
                url: `${sentryOtlpEndpoint}/v1/metrics`,
                headers: {
                    'x-sentry-auth': `sentry sentry_key=${url.username}, sentry_version=7`,
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

    sdk.start();
}

export async function shutdownTelemetry(): Promise<void> {
    if (sdk) {
        await sdk.shutdown();
    }
}
