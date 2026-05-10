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
    await ref.set({ ...event, received_at: admin.firestore.FieldValue.serverTimestamp() });
    await db.collection(`${BASE}/pulso_events`).add({
      type: "ingestion_received",
      entityType: "ingestion",
      entityId: event.event_id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      data: { eventType: event.event_type, summary: event.payload?.summary }
    });
    res.status(201).json({ status: "success", event_id: event.event_id });
  } catch (e) { res.status(500).send("Error"); }
});
