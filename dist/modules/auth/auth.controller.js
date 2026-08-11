"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const auth_schema_1 = require("./auth.schema");
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)();
const AuthController = {
    async auth(request, reply) {
        try {
            const payload = auth_schema_1.AuthRequestScheme.parse(request.body);
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
                });
            }
            const token = await reply.jwtSign({ scope: ['render:pdf'] });
            return reply.send({
                success: true,
                token,
                tokenType: 'Bearer',
                expiresIn: process.env.JWT_EXPIRES_IN || '1d'
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({
                    success: false,
                    error: 'Invalid request',
                    details: error.issues
                });
            }
            return reply.code(500).send({
                success: false,
                error: 'Login failed',
                details: error
            });
        }
    }
};
exports.default = AuthController;
//# sourceMappingURL=auth.controller.js.map