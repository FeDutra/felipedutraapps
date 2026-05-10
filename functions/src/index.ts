import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
admin.initializeApp();
const db = admin.firestore();
export const pulsoIngest = onRequest({ region: "us-central1", secrets: ["PULSO_INGEST_TOKEN"] }, async (req, res) => {
  if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.substring(7) : null;
  if (!token || token !== process.env.PULSO_INGEST_TOKEN) { res.status(401).send("Unauthorized"); return; }
  const event = req.body;
  if (!event || event.version !== "v1" || !event.event_id) { res.status(400).send("Invalid Payload"); return; }
  const WORKSPACE_ID = "felipe_dutra";
  const BASE = `workspaces/${WORKSPACE_ID}`;
  try {
    const ref = db.collection(`${BASE}/pulso_ingestion_events`).doc(event.event_id);
    const doc = await ref.get();
    if (doc.exists) { res.status(200).json({ status: "duplicate" }); return; }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    
    // 1. Save Ingestion Event (Backdoor for OpenClaw)
    await ref.set({ 
      ...event, 
      ingestionStatus: "received",
      createdAt: timestamp,
      updatedAt: timestamp,
      originLabel: "OpenClaw"
    });

    // 2. Create Audit Event (Barramento)
    await db.collection(`${BASE}/pulso_events`).add({
      eventType: "ingestion_received",
      entityType: "ingestion",
      entityRef: event.event_id,
      actorType: "agent",
      actorRef: "openclaw",
      origin: "openclaw",
      createdAt: timestamp,
      outboxStatus: "pending",
      payloadSummary: `Ingestão recebida: ${event.event_type} (${event.event_id})`,
      payloadSnapshot: event.payload || {}
    });

    res.status(201).json({ status: "success", event_id: event.event_id });
  } catch (e) { 
    console.error("Ingestion Error:", e);
    res.status(500).send("Internal Error"); 
  }
});
