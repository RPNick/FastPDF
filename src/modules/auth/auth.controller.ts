import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AuthRequestScheme } from './auth.schema'
import pino from 'pino';

const logger = pino();

const AuthController = {
    async auth(request: FastifyRequest, reply: FastifyReply) {
        try {
            const payload = AuthRequestScheme.parse(request.body);
            const serverPassword = process.env.AUTH_PASSWORD;

            if (!serverPassword) {
                logger.error({ requestId: request.id }, 'AUTH_PASSWORD not configured');
                return reply.code(500).send({
                    success: false,
                    error: 'AUTH_PASSWORD not configured'
                });
            }
            if (payload.password !== serverPassword) {
                return reply.code(401).send({
                    success: false,
                    error: 'Invalid credentials'
                })
            }

            const token = await reply.jwtSign({ scope: ['render:pdf'] })

            return reply.send({
                success: true,
                token,
                tokenType: 'Bearer',
                expiresIn: process.env.JWT_EXPIRES_IN || '1d'
            })
        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.code(400).send({
                    success: false,
                    error: 'Invalid request',
                    details: error.issues
                })
            }

            return reply.code(500).send({
                success: false,
                error: 'Login failed',
                details: error
            })
        }
    }
}

export default AuthController;