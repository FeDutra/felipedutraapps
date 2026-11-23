"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pulsoFinanceRead = void 0;
const https_1 = require("firebase-functions/v2/https");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const core_1 = require("./core");
const projection_1 = require("./projection");
// Read surface is separate from provider credentials and banking connections.
exports.pulsoFinanceRead = (0, https_1.onRequest)({ region: 'us-central1', timeoutSeconds: 30 }, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.set('Vary', 'Origin');
    const origin = req.headers.origin;
    const allowed = ['https://felipedutra.com', 'https://www.felipedutra.com', 'https://felipedutraapps.web.app', 'https://felipedutraapps.firebaseapp.com', 'tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost'];
    if (origin && !allowed.includes(origin) && !/^https:\/\/felipedutraapps--[a-z0-9-]+\.web\.app$/.test(origin)) {
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
        const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
        if (!token)
            throw new core_1.OpenFinanceError('authentication_required', 401);
        let user;
        try {
            user = await (0, auth_1.getAuth)().verifyIdToken(token, true);
        }
        catch {
            throw new core_1.OpenFinanceError('authentication_required', 401);
        }
        if (user.firebase?.sign_in_provider === 'anonymous')
            throw new core_1.OpenFinanceError('authentication_required', 401);
        const doc = await (0, firestore_1.getFirestore)().collection('private_finance_projections').doc(user.uid).get();
        res.status(200).json((0, projection_1.readFinanceProjection)(doc.exists ? doc.data() : null, user.uid));
    }
    catch (e) {
        const known = e instanceof core_1.OpenFinanceError;
        res.status(known ? e.status : 500).json({ error: known ? e.message : 'snapshot_unavailable' });
    }
});
//# sourceMappingURL=read.js.map