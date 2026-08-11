import 'fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { RenderOptions } from '../modules/pdf-render/pdf-render.types';

declare module 'fastify' {
    interface FastifyInstance {
        authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
        pdfRenderController: {
            renderPdf: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
        };
        pdfRenderService: {
            initialize: () => Promise<void>;
            renderHTML: (html: string, options?: RenderOptions) => Promise<Buffer>;
            close: () => Promise<void>;
        };
        authController: {
            auth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
        };
    }
}