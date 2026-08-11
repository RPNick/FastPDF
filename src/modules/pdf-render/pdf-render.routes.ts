import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';

export default async function PdfRenderRoutes(app: FastifyInstance) {
  app.route({
    method: 'POST',
    url: '/pdf-render',
    preHandler: [app.authenticate],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      return app.pdfRenderController.renderPdf(request, reply);
    }
  });
}