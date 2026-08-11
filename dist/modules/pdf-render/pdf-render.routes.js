"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PdfRenderRoutes;
async function PdfRenderRoutes(app) {
    app.route({
        method: 'POST',
        url: '/pdf-render',
        preHandler: [app.authenticate],
        handler: async (request, reply) => {
            return app.pdfRenderController.renderPdf(request, reply);
        }
    });
}
//# sourceMappingURL=pdf-render.routes.js.map