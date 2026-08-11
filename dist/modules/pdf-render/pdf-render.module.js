"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfRenderService = void 0;
exports.default = PdfRenderModule;
const pdf_render_controller_1 = __importDefault(require("./pdf-render.controller"));
const pdf_render_routes_1 = __importDefault(require("./pdf-render.routes"));
const pdf_render_service_1 = __importDefault(require("./pdf-render.service"));
exports.PdfRenderService = pdf_render_service_1.default;
async function PdfRenderModule(app) {
    await pdf_render_service_1.default.initialize();
    app.decorate('pdfRenderController', pdf_render_controller_1.default);
    app.decorate('pdfRenderService', pdf_render_service_1.default);
    app.register(pdf_render_routes_1.default);
    app.addHook('onClose', async () => {
        await pdf_render_service_1.default.close();
    });
}
//# sourceMappingURL=pdf-render.module.js.map