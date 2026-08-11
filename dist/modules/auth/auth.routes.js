"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AuthRoutes;
async function AuthRoutes(app) {
    app.post('/authenticate', app.authController.auth);
}
//# sourceMappingURL=auth.routes.js.map