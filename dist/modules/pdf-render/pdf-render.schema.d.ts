import { z } from 'zod';
export declare const RenderRequestSchema: z.ZodObject<{
    html: z.ZodString;
    filename: z.ZodOptional<z.ZodString>;
    options: z.ZodOptional<z.ZodObject<{
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        format: z.ZodOptional<z.ZodEnum<{
            A4: "A4";
            Letter: "Letter";
            Legal: "Legal";
        }>>;
        margin: z.ZodOptional<z.ZodObject<{
            top: z.ZodOptional<z.ZodNumber>;
            right: z.ZodOptional<z.ZodNumber>;
            bottom: z.ZodOptional<z.ZodNumber>;
            left: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type RenderRequestSchema = z.infer<typeof RenderRequestSchema>;
//# sourceMappingURL=pdf-render.schema.d.ts.map