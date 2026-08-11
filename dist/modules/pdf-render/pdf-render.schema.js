"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenderRequestSchema = void 0;
const zod_1 = require("zod");
exports.RenderRequestSchema = zod_1.z.object({
    html: zod_1.z.string()
        .min(1, 'HTML cannot be empty')
        .max(parseInt(process.env.MAX_HTML_SIZE || '5242880', 10), `HTML exceeds max size: ${process.env.MAX_HTML_SIZE || '5242880'}`),
    filename: zod_1.z.string().optional(),
    options: zod_1.z.object({
        width: zod_1.z.number().int().positive().optional(),
        height: zod_1.z.number().int().positive().optional(),
        format: zod_1.z.enum(['A4', 'Letter', 'Legal']).optional(),
        margin: zod_1.z.object({
            top: zod_1.z.number().int().positive().optional(),
            right: zod_1.z.number().int().positive().optional(),
            bottom: zod_1.z.number().int().positive().optional(),
            left: zod_1.z.number().int().positive().optional(),
        }).optional()
    }).optional()
});
//# sourceMappingURL=pdf-render.schema.js.map