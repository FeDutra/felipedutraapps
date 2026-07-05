"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pulsoActiveMessageTrigger = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const firestore_2 = require("firebase-admin/firestore");
const pulsoLedgerEmitter_1 = require("./lib/pulsoLedgerEmitter");
/**
 * Escuta passiva de eventos 'active_message' criados na fila pulso_requests.
 * Essencial para que os CRONs autônomos da OpenClaw consigam piscar alertas e cards visuais
 * na UI do Ateliê sem precisar passar pelo webhook /complete.
 */
exports.pulsoActiveMessageTrigger = (0, firestore_1.onDocumentCreated)({ document: "workspaces/{workspaceId}/pulso_requests/{requestId}", region: "us-central1" }, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const data = snap.data();
    // Filtro estrito: Processa apenas os CRONs proativos (active_message)
    if (data.requestType !== "active_message") {
        return;
    }
    // A Lótus prometeu enviar os eventos como um campo estruturado no payload.
    // Vamos sondar nos três lugares mais comuns (raiz, payload ou meta).
    const events = data.pulsoEvents || data.payload?.pulsoEvents || data.meta?.pulsoEvents;
    if (events && Array.isArray(events) && events.length > 0) {
        const db = (0, firestore_2.getFirestore)();
        console.log(`[pulsoActiveMessageTrigger] Encontrados ${events.length} pulsoEvents no active_message ${snap.id}`);
        // 1. Emite o Ledger da PULSO (os cards flutuantes na UI)
        await (0, pulsoLedgerEmitter_1.emitPulsoLedgerEvents)(events, db);
        // 2. Grava a confirmação de recebimento (Ack) exigida pela arquitetura da Lótus
        await snap.ref.update({
            "meta.pulsoAck": {
                status: "processed",
                processedAt: firestore_2.FieldValue.serverTimestamp()
            }
        });
        console.log(`[pulsoActiveMessageTrigger] Ack de auditoria gravado no active_message ${snap.id}`);
    }
    else {
        console.log(`[pulsoActiveMessageTrigger] active_message ${snap.id} não possui pulsoEvents. Ignorando.`);
    }
});
//# sourceMappingURL=pulsoActiveMessageTrigger.js.map