import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * Sanitizes an object by removing undefined values
 */
const sanitize = (obj: any) => {
  const result: any = {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  });
  return result;
};

export const pulsoRequests = onRequest(
  { region: "us-central1", secrets: ["PULSO_INGEST_TOKEN"] },
  async (req, res) => {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.substring(7) : null;
    if (!token || token !== process.env.PULSO_INGEST_TOKEN) {
      res.status(401).send("Unauthorized");
      return;
    }

    const WORKSPACE_ID = "felipe_dutra";
    const BASE = `workspaces/${WORKSPACE_ID}/pulso_requests`;

    const path = req.path.replace(/\/$/, "");

    try {
      // ── GET /pending ──────────────────────────────────────────────────────
      if (req.method === "GET" && (path === "/pending" || path === "")) {
        const { limit = "20", requestType, status = "requested" } = req.query;
        
        let query: admin.firestore.Query = db.collection(BASE);
        
        // Default filter for non-archived
        query = query.where("archived", "==", false);
        
        if (status) query = query.where("status", "==", status);
        if (requestType) query = query.where("requestType", "==", requestType);
        
        const snapshot = await query.limit(Number(limit)).get();
        const requests = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
          // Convert timestamps to ISO strings for JSON
          requestedAt: doc.data().requestedAt?.toDate()?.toISOString(),
          updatedAt: doc.data().updatedAt?.toDate()?.toISOString(),
        }));

        res.status(200).json(requests);
        return;
      }

      // ── POST /claim ────────────────────────────────────────────────────────
      if (req.method === "POST" && path === "/claim") {
        const { requestId, processedBy } = req.body;
        if (!requestId || !processedBy) {
          res.status(400).send("Missing requestId or processedBy");
          return;
        }

        const docRef = db.collection(BASE).doc(requestId);
        
        const result = await db.runTransaction(async (transaction) => {
          const docSnap = await transaction.get(docRef);
          if (!docSnap.exists) return { status: 404, message: "Request not found" };
          
          const data = docSnap.data()!;
          if (data.status !== "requested") {
            return { status: 409, message: `Request is in status ${data.status}` };
          }

          const ts = admin.firestore.FieldValue.serverTimestamp();
          transaction.update(docRef, {
            status: "running",
            processedBy,
            startedAt: ts,
            updatedAt: ts,
          });

          return { status: 200, message: "claimed" };
        });

        res.status(result.status).send(result.message);
        return;
      }

      // ── POST /complete ─────────────────────────────────────────────────────
      if (req.method === "POST" && path === "/complete") {
        const { requestId, result, emittedEvents, pulsoEventId } = req.body;
        if (!requestId) {
          res.status(400).send("Missing requestId");
          return;
        }

        const ts = admin.firestore.FieldValue.serverTimestamp();
        const updateData = sanitize({
          status: "completed",
          result: result || null,
          emittedEvents: emittedEvents || null,
          pulsoEventId: pulsoEventId || null,
          processedAt: ts,
          updatedAt: ts,
        });

        await db.collection(BASE).doc(requestId).update(updateData);
        res.status(200).send("completed");
        return;
      }

      // ── POST /fail ─────────────────────────────────────────────────────────
      if (req.method === "POST" && path === "/fail") {
        const { requestId, error, recoverable, nextSuggestedAction } = req.body;
        if (!requestId) {
          res.status(400).send("Missing requestId");
          return;
        }

        const ts = admin.firestore.FieldValue.serverTimestamp();
        const updateData = sanitize({
          status: "failed",
          error: error || "Unknown error",
          recoverable: recoverable ?? false,
          nextSuggestedAction: nextSuggestedAction || null,
          processedAt: ts,
          updatedAt: ts,
        });

        await db.collection(BASE).doc(requestId).update(updateData);
        res.status(200).send("failed");
        return;
      }

      // ── POST /needs-clarification ──────────────────────────────────────────
      if (req.method === "POST" && path === "/needs-clarification") {
        const { requestId, question, missingFields } = req.body;
        if (!requestId) {
          res.status(400).send("Missing requestId");
          return;
        }

        const ts = admin.firestore.FieldValue.serverTimestamp();
        const updateData = sanitize({
          status: "needs_clarification",
          result: {
            question: question || "Necessário esclarecimento",
            missingFields: missingFields || [],
          },
          updatedAt: ts,
        });

        await db.collection(BASE).doc(requestId).update(updateData);
        res.status(200).send("status updated to needs_clarification");
        return;
      }

      res.status(404).send("Endpoint not found");
    } catch (e) {
      console.error("Requests Bridge Error:", e);
      res.status(500).send("Internal Error");
    }
  }
);
