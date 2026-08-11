"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const puppeteer_1 = __importDefault(require("puppeteer"));
const pino_1 = __importDefault(require("pino"));
const api_1 = require("@opentelemetry/api");
const logger = (0, pino_1.default)();
const tracer = api_1.trace.getTracer('fast-pdf.pdf-render');
class Semaphore {
    constructor(permits) {
        this.queue = [];
        this.permits = permits;
    }
    async acquire() {
        if (this.permits > 0) {
            this.permits--;
            return;
        }
        return new Promise(resolve => this.queue.push(resolve));
    }
    release() {
        const next = this.queue.shift();
        if (next) {
            next();
        }
        else {
            this.permits++;
        }
    }
}
class PdfRenderService {
    constructor(concurrentRenders = 5) {
        this.browser = null;
        this.semaphore = new Semaphore(concurrentRenders);
    }
    async initialize() {
        this.browser = await puppeteer_1.default.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
        logger.info('Browser initialized within PDFRenderService. Ready to recieve requests');
    }
    ;
    async renderHTML(html, options = {}) {
        return tracer.startActiveSpan('pdf.render', async (span) => {
            span.setAttributes({
                'pdf.format': options.format ?? 'letter',
                'html.size_bytes': Buffer.byteLength(html),
            });
            await this.semaphore.acquire();
            try {
                if (!this.browser) {
                    throw new Error('Browser not available');
                }
                const page = await this.browser.newPage();
                try {
                    await page.setViewport({
                        width: options?.width ?? 1920,
                        height: options?.height ?? 1080
                    });
                    await page.setContent(html, {
                        waitUntil: options?.waitUntil ?? 'networkidle0',
                        timeout: options?.timeout ?? 26260
                    });
                    const pdfBytes = await page.pdf({
                        format: options?.format ?? 'letter',
                        margin: options?.margin ?? {
                            top: 16,
                            right: 16,
                            bottom: 16,
                            left: 16
                        }
                    });
                    span.setStatus({ code: api_1.SpanStatusCode.OK });
                    return Buffer.from(pdfBytes);
                }
                finally {
                    await page.close();
                }
            }
            catch (err) {
                span.setStatus({ code: api_1.SpanStatusCode.ERROR, message: String(err) });
                span.recordException(err);
                throw err;
            }
            finally {
                this.semaphore.release();
                span.end();
            }
        });
    }
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
        logger.info('Browser closed');
    }
}
;
exports.default = new PdfRenderService(Number(process.env.CONCURRENT_RENDERS ?? 5));
//# sourceMappingURL=pdf-render.service.js.map