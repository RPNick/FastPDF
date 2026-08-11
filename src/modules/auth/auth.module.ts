import type { FastifyInstance } from 'fastify';
import AuthController from './auth.controller';
import AuthRoutes from './auth.routes';

export default async function AuthModule(app: FastifyInstance) {
    app.decorate('authController', AuthController);
    app.register(AuthRoutes);
}