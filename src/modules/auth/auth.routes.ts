import type { FastifyInstance } from 'fastify';

export default async function AuthRoutes(app: FastifyInstance) {
    app.post('/authenticate', app.authController.auth);
}