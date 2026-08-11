"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthRequestScheme = void 0;
const zod_1 = require("zod");
exports.AuthRequestScheme = zod_1.z.object({
    password: zod_1.z.string().min(1)
});
//# sourceMappingURL=auth.schema.js.map