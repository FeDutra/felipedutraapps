"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.pulsoIngest = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
/**
 * @function pulsoIngest
 * @description Secure ingestion endpoint for OpenClaw/Lótus events.
 * Maps to /api/pulso/ingest via Firebase Hosting rewrites.
 */
exports.pulsoIngest = (0, https_1.onRequest)({
    region: "us-central1",
    secrets: ["PULSO_INGEST_TOKEN", "PULSO_INGEST_HMAC_SECRET"]
}, async (req, res) => {
    // 1. Method Check
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    // 2. Auth Check
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
    const serverToken = process.env.PULSO_INGEST_TOKEN;
    if (!token || !serverToken || token !== serverToken) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    // 3. Payload Validation (v1)
    const event = req.body;
    if (!event || event.version !== "v1" || !event.event_id || !event.dedupe_key || !event.event_type) {
        res.status(400).json({ error: "Invalid payload v1" });
        return;
    }
    // Common workspace paths
    const WORKSPACE_ID = "felipe_dutra"; // Fixed for this implementation as per project context
    const BASE_PATH = `workspaces/${WORKSPACE_ID}`;
    const ingestionEventsPath = `${BASE_PATH}/pulso_ingestion_events`;
    const pulsoEventsPath = `${BASE_PATH}/pulso_events`;
    try {
        // 4. Deduplication Check
        const ingestionEventsRef = db.collection(ingestionEventsPath);
        // Check event_id (document ID)
        const eventDoc = await ingestionEventsRef.doc(event.event_id).get();
        if (eventDoc.exists) {
            res.status(200).json({ status: "duplicate", message: "Event ID already processed" });
            return;
        }
        // Check dedupe_key (field)
        const dedupeSnap = await ingestionEventsRef
            .where("dedupe_key", "==", event.dedupe_key)
            .limit(1)
            .get();
        if (!dedupeSnap.empty) {
            res.status(200).json({ status: "ignored", message: "Dedupe key already exists" });
            return;
        }
        // 5. Save Ingestion Event
        const ingestionEventData = {
            ...event,
            received_at: admin.firestore.FieldValue.serverTimestamp(),
            processed_at: admin.firestore.FieldValue.serverTimestamp(),
            ingestionStatus: "processed"
        };
        await ingestionEventsRef.doc(event.event_id).set(ingestionEventData);
        // 6. Save Pulso Event (System Visibility)
        await db.collection(pulsoEventsPath).add({
            id: `ev_${Date.now()}`,
            type: "ingestion_received",
            entityType: "ingestion",
            entityId: event.event_id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            data: {
                eventType: event.event_type,
                source: event.source?.product || "unknown",
                summary: event.payload?.summary || "Evento recebido via API"
            },
            outboxStatus: "completed"
        });
        // 7. Roteamento por event_type
        const type = event.event_type;
        switch (type) {
            case 'alert':
                await db.collection(`${BASE_PATH}/pulso_alerts`).add({
                    id: `alert_${Date.now()}`,
                    name: event.name || "Alerta Externo",
                    description: event.payload?.summary || event.payload?.raw_input || "Sinal recebido da Lótus",
                    severity: event.payload?.severity || "medium",
                    status: "active",
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    origin: "openclaw"
                });
                break;
            case 'agent_update':
                if (event.actor?.id) {
                    const agentId = event.actor.id;
                    const agentRef = db.collection(`${BASE_PATH}/pulso_agents`).doc(agentId);
                    await agentRef.set({
                        lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        status: event.payload?.status || "active",
                        lastSummary: event.payload?.summary
                    }, { merge: true });
                    // Also create a technical log
                    await db.collection(`${BASE_PATH}/pulso_logs`).add({
                        id: `log_${Date.now()}`,
                        type: "agent_activity",
                        message: `Agente ${event.actor.name || agentId} atualizado: ${event.payload?.status || 'ativo'}`,
                        level: "info",
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        metadata: { agentId, payload: event.payload }
                    });
                }
                break;
            case 'task':
                // Se confiança for alta, cria tarefa. Caso contrário, poderia ir para Inbox.
                // Seguindo o Stage 7 original: vamos criar Task se vier estruturado.
                await db.collection(`${BASE_PATH}/pulso_tasks`).add({
                    id: `task_${Date.now()}`,
                    title: event.name || "Tarefa via OpenClaw",
                    description: event.payload?.summary || event.payload?.raw_input || "Tarefa capturada via ingestão externa",
                    status: "todo",
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    source: "openclaw"
                });
                break;
            case 'decision':
                await db.collection(`${BASE_PATH}/pulso_decisions`).add({
                    id: `decision_${Date.now()}`,
                    title: event.name || "Decisão Pendente",
                    description: event.payload?.summary || event.payload?.raw_input || "Decisão sugerida pela Lótus",
                    status: "pending",
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                break;
            default:
                // Caso não seja um tipo prioritário, salvamos no Inbox para triagem
                await db.collection(`${BASE_PATH}/pulso_inbox_items`).add({
                    id: `inbox_${Date.now()}`,
                    name: event.name || `Ingestão: ${type}`,
                    description: event.payload?.summary || event.payload?.raw_input || "Item recebido via API de Ingestão",
                    type: "ingestion",
                    status: "new",
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    metadata: { ...event.payload, original_type: type }
                });
        }
        res.status(201).json({
            status: "success",
            event_id: event.event_id,
            message: "Ingestion processed and routed successfully"
        });
    }
    catch (error) {
        console.error("Critical Ingestion Error:", error);
        res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});
//# sourceMappingURL=index.js.map