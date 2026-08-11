"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AuthModule;
const auth_controller_1 = __importDefault(require("./auth.controller"));
const auth_routes_1 = __importDefault(require("./auth.routes"));
async function AuthModule(app) {
    app.decorate('authController', auth_controller_1.default);
    app.register(auth_routes_1.default);
}
//# sourceMappingURL=auth.module.js.map