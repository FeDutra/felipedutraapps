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
exports.processOpenClawQueue = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const v2_1 = require("firebase-functions/v2");
const admin = __importStar(require("firebase-admin"));
/**
 * Scheduled Cloud Function that processes Pulso requests awaiting OpenClaw.
 * Runs every minute (configurable) and handles the lifecycle:
 *   1. Claim request (status → processing_by_openclaw)
 *   2. Call mock OpenClaw adapter (replace with real call later)
 *   3. Store openclawResult and set status to proposal_ready
 */
exports.processOpenClawQueue = (0, scheduler_1.onSchedule)({
    schedule: "every 1 minutes", // adjust after approval if needed
    timeoutSeconds: 300,
}, async () => {
    const db = admin.firestore();
    const WORKSPACE_ID = "felipe_dutra";
    const BASE = `workspaces/${WORKSPACE_ID}/pulso_requests`;
    // 1️⃣ Find pending requests (requested or queued_for_openclaw)
    const pendingQuery = db
        .collection(BASE)
        .where("archived", "==", false)
        .where("status", "in", ["requested", "queued_for_openclaw"])
        .orderBy("requestedAt", "desc")
        .limit(10); // batch size – can be tuned via config
    const snap = await pendingQuery.get();
    if (snap.empty) {
        v2_1.logger.info("⚡ No pending Pulso requests for OpenClaw.");
        return;
    }
    for (const docSnap of snap.docs) {
        const requestId = docSnap.id;
        const docRef = db.collection(BASE).doc(requestId);
        const data = docSnap.data();
        try {
            // 2️⃣ Claim the request
            await docRef.update({
                status: "processing_by_openclaw",
                processedBy: "openclaw-queue-processor",
                startedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            v2_1.logger.info(`🛠️ Claimed request ${requestId}`);
            // 3️⃣ Mock OpenClaw adapter (replace with real call when available)
            const simulatedResult = {
                status: "success",
                intent: "unknown",
                responseText: data.input && data.input.includes("PULSO_DIRECT_TEST_001")
                    ? "DIRECT_OK_001"
                    : "SIMULATED_RESPONSE",
                summary: "Mocked OpenClaw response",
                confidence: "high",
                riskLevel: "low",
                requiresHumanApproval: false,
                canExecuteNow: false,
                needsClarification: false,
            };
            // 4️⃣ Persist result and finalize status
            await docRef.update({
                openclawResult: simulatedResult,
                status: "proposal_ready",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            v2_1.logger.info(`✅ Processed request ${requestId} → proposal_ready`);
        }
        catch (err) {
            // 5️⃣ On failure, mark as failed with error details
            await docRef.update({
                status: "failed",
                error: err.message ?? "unknown",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            v2_1.logger.error(`❌ Failed processing request ${requestId}:`, err);
        }
    }
});
//# sourceMappingURL=openclawQueueProcessor.js.map