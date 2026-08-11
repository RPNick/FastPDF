import { z } from 'zod';

export const RenderRequestSchema = z.object({
    html: z.string()
        .min(1, 'HTML cannot be empty')
        .max(parseInt(process.env.MAX_HTML_SIZE || '5242880', 10), `HTML exceeds max size: ${process.env.MAX_HTML_SIZE || '5242880'}`),
    filename: z.string().optional(),
    options: z.object({
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        format: z.enum(['A4', 'Letter', 'Legal']).optional(),
        margin: z.object({
            top: z.number().int().positive().optional(),
            right: z.number().int().positive().optional(),
            bottom: z.number().int().positive().optional(),
            left: z.number().int().positive().optional(),
        }).optional()
    }).optional()
})

export type RenderRequestSchema = z.infer<typeof RenderRequestSchema>