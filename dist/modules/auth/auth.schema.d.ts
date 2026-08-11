import { z } from 'zod';
export declare const AuthRequestScheme: z.ZodObject<{
    password: z.ZodString;
}, z.core.$strip>;
export type AuthRequestScheme = z.infer<typeof AuthRequestScheme>;
//# sourceMappingURL=auth.schema.d.ts.map