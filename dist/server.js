"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const env_1 = require("./env");
const telemetry_1 = require("./telemetry");
const app_1 = require("./app");
const env = (0, env_1.validateEnv)();
(0, telemetry_1.initTelemetry)(env.OTEL_SERVICE_NAME);
async function start() {
    const app = await (0, app_1.setupApp)(env);
    process.on('SIGTERM', async () => {
        await app.close();
        await (0, telemetry_1.shutdownTelemetry)();
    });
    await app.listen({ port: env.PORT, host: env.HOST });
}
start().catch((error) => {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=server.js.map