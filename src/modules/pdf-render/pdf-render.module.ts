import PdfRenderController from './pdf-render.controller';
import PdfRenderRoutes from './pdf-render.routes';
import PdfRenderService from './pdf-render.service';
import type { FastifyInstance } from 'fastify';

export default async function PdfRenderModule(app: FastifyInstance) {
  await PdfRenderService.initialize();

  app.decorate('pdfRenderController', PdfRenderController);
  app.decorate('pdfRenderService', PdfRenderService);

  app.register(PdfRenderRoutes);

  app.addHook('onClose', async () => {
    await PdfRenderService.close();
  });
}

// export services used by other modules
export { PdfRenderService };
