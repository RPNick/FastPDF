import { z } from 'zod';

export const AuthRequestScheme = z.object({
    password: z.string().min(1)
});

export type AuthRequestScheme = z.infer<typeof AuthRequestScheme>;