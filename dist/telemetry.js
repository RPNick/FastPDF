"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initTelemetry = initTelemetry;
exports.shutdownTelemetry = shutdownTelemetry;
const sdk_node_1 = require("@opentelemetry/sdk-node");
const auto_instrumentations_node_1 = require("@opentelemetry/auto-instrumentations-node");
const exporter_trace_otlp_http_1 = require("@opentelemetry/exporter-trace-otlp-http");
const exporter_metrics_otlp_http_1 = require("@opentelemetry/exporter-metrics-otlp-http");
const sdk_metrics_1 = require("@opentelemetry/sdk-metrics");
const resources_1 = require("@opentelemetry/resources");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
let sdk;
function initTelemetry(serviceName, version = '1.0.0') {
    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    const sentryDsn = process.env.SENTRY_DSN;
    // Sentry OTLP endpoint: https://o<org>.ingest.sentry.io/api/<project>/integration/otlp
    // Requires sentry-trace header for trace context propagation
    if (sentryDsn) {
        const url = new URL(sentryDsn);
        const orgId = url.hostname.split('.')[0].replace('o', '');
        const projectId = url.pathname.split('/').pop();
        const sentryOtlpEndpoint = `https://o${orgId}.ingest.sentry.io/api/${projectId}/integration/otlp`;
        sdk = new sdk_node_1.NodeSDK({
            resource: (0, resources_1.resourceFromAttributes)({
                [semantic_conventions_1.ATTR_SERVICE_NAME]: serviceName,
                [semantic_conventions_1.ATTR_SERVICE_VERSION]: version,
            }),
            traceExporter: new exporter_trace_otlp_http_1.OTLPTraceExporter({
                url: `${sentryOtlpEndpoint}/v1/traces`,
                headers: {
                    'x-sentry-auth': `sentry sentry_key=${url.username}, sentry_version=7`,
                },
            }),
            metricReader: new sdk_metrics_1.PeriodicExportingMetricReader({
                exporter: new exporter_metrics_otlp_http_1.OTLPMetricExporter({
                    url: `${sentryOtlpEndpoint}/v1/metrics`,
                    headers: {
                        'x-sentry-auth': `sentry sentry_key=${url.username}, sentry_version=7`,
                    },
                }),
                exportIntervalMillis: 15000,
            }),
            instrumentations: [
                (0, auto_instrumentations_node_1.getNodeAutoInstrumentations)({
                    '@opentelemetry/instrumentation-fs': { enabled: false },
                }),
            ],
        });
        sdk.start();
        return;
    }
    // Generic OTLP endpoint (e.g., Grafana Cloud, Jaeger, self-hosted collector)
    if (!endpoint)
        return;
    sdk = new sdk_node_1.NodeSDK({
        resource: (0, resources_1.resourceFromAttributes)({
            [semantic_conventions_1.ATTR_SERVICE_NAME]: serviceName,
            [semantic_conventions_1.ATTR_SERVICE_VERSION]: version,
        }),
        traceExporter: new exporter_trace_otlp_http_1.OTLPTraceExporter({
            url: `${endpoint}/v1/traces`,
        }),
        metricReader: new sdk_metrics_1.PeriodicExportingMetricReader({
            exporter: new exporter_metrics_otlp_http_1.OTLPMetricExporter({
                url: `${endpoint}/v1/metrics`,
            }),
            exportIntervalMillis: 15000,
        }),
        instrumentations: [
            (0, auto_instrumentations_node_1.getNodeAutoInstrumentations)({
                '@opentelemetry/instrumentation-fs': { enabled: false },
            }),
        ],
    });
    sdk.start();
}
async function shutdownTelemetry() {
    if (sdk) {
        await sdk.shutdown();
    }
}
//# sourceMappingURL=telemetry.js.map