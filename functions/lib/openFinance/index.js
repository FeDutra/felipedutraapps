"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pulsoOpenFinance = void 0;
const https_1 = require("firebase-functions/v2/https");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const node_crypto_1 = require("node:crypto");
const core_1 = require("./core");
const origins = new Set(['https://felipedutra.com', 'https://www.felipedutra.com', 'https://felipedutraapps.web.app', 'https://felipedutraapps.firebaseapp.com', 'tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost']);
exports.pulsoOpenFinance = (0, https_1.onRequest)({ region: 'us-central1', timeoutSeconds: 90, secrets: ['PLUGGY_CLIENT_ID', 'PLUGGY_CLIENT_SECRET'] }, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.set('Vary', 'Origin');
    const origin = req.headers.origin;
    const local = process.env.FUNCTIONS_EMULATOR === 'true' && !!origin && /^http:\/\/localhost:(3000|3001)$/.test(origin);
    if (origin && !origins.has(origin) && !local) {
        res.status(403).json({ error: 'origin_not_allowed' });
        return;
    }
    if (origin)
        res.set('Access-Control-Allow-Origin', origin);
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.status(204).end();
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'method_not_allowed' });
        return;
    }
    try {
        const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
        if (!bearer)
            throw new core_1.OpenFinanceError('authentication_required', 401);
        let user;
        try {
            user = await (0, auth_1.getAuth)().verifyIdToken(bearer, true);
        }
        catch {
            throw new core_1.OpenFinanceError('authentication_required', 401);
        }
        (0, core_1.authorizeUser)(user.uid, user.firebase?.sign_in_provider === 'anonymous', process.env.PULSO_FINANCE_ALLOWED_UIDS);
        const service = new core_1.PluggyConnectService({ clientId: process.env.PLUGGY_CLIENT_ID, clientSecret: process.env.PLUGGY_CLIENT_SECRET });
        const db = (0, firestore_1.getFirestore)();
        if (req.path.replace(/\/$/, '').endsWith('/connect-token')) {
            const rateRef = db.collection('private_finance_token_rates').doc(user.uid);
            await db.runTransaction(async (tx) => {
                const doc = await tx.get(rateRef);
                const last = doc.data()?.issuedAt?.toMillis?.() || 0;
                if (Date.now() - last < 10000)
                    throw new core_1.OpenFinanceError('try_again_shortly', 429);
                tx.set(rateRef, { issuedAt: firestore_1.Timestamp.now() });
            });
            res.status(200).json(await service.createToken(user.uid));
            return;
        }
        if (req.path.replace(/\/$/, '').endsWith('/connections')) {
            const scope = (0, core_1.validateScope)(req.body?.scope);
            const record = await service.verifyConnection(user.uid, req.body?.itemId, scope);
            const id = (0, node_crypto_1.createHash)('sha256').update(`pluggy:${record.itemId}`).digest('hex');
            // Admin-only root collection: existing workspace-wide client rules cannot expose bank bindings.
            const ref = db.collection('private_finance_connections').doc(id);
            await db.runTransaction(async (tx) => {
                const old = await tx.get(ref);
                if (old.exists && (old.data()?.ownerUid !== user.uid || old.data()?.scope !== scope))
                    throw new core_1.OpenFinanceError('connection_binding_conflict', 409);
                tx.set(ref, { ...record, updatedAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
            });
            res.status(200).json({ connectionId: id, state: record.state, scope });
            return;
        }
        throw new core_1.OpenFinanceError('not_found', 404);
    }
    catch (error) {
        const known = error instanceof core_1.OpenFinanceError;
        res.status(known ? error.status : 500).json({ error: known ? error.message : 'open_finance_unavailable' });
    }
});
//# sourceMappingURL=index.js.map