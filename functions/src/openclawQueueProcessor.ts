import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";

/**
 * Scheduled Cloud Function that processes Pulso requests awaiting OpenClaw.
 * Runs every minute (configurable) and handles the lifecycle:
 *   1. Claim request (status → processing_by_openclaw)
 *   2. Call mock OpenClaw adapter (replace with real call later)
 *   3. Store openclawResult and set status to proposal_ready
 */
export const processOpenClawQueue = onSchedule(
  {
    schedule: "every 1 minutes", // adjust after approval if needed
    timeoutSeconds: 300,
  },
  async () => {
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
      logger.info("⚡ No pending Pulso requests for OpenClaw.");
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
        logger.info(`🛠️ Claimed request ${requestId}`);

        // 3️⃣ Mock OpenClaw adapter (replace with real call when available)
        const simulatedResult = {
          status: "success",
          intent: "unknown",
          responseText:
            data.input && data.input.includes("PULSO_DIRECT_TEST_001")
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
        logger.info(`✅ Processed request ${requestId} → proposal_ready`);
      } catch (err: any) {
        // 5️⃣ On failure, mark as failed with error details
        await docRef.update({
          status: "failed",
          error: err.message ?? "unknown",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        logger.error(`❌ Failed processing request ${requestId}:`, err);
      }
    }
  }
);
