"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.previewOwner = previewOwner;
const core_1 = require("./core");
function previewOwner(record, now = Date.now()) {
    const expiry = record?.expiresAt?.toMillis?.();
    if (!record || record.scope !== 'finance_snapshot_read' || record.revoked !== false || !Number.isFinite(expiry) || expiry <= now || typeof record.ownerUid !== 'string' || !record.ownerUid)
        throw new core_1.OpenFinanceError('preview_access_expired_or_invalid', 401);
    return record.ownerUid;
}
//# sourceMappingURL=preview.js.map