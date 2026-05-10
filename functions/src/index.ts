import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
admin.initializeApp();
const db = admin.firestore();

export const pulsoIngest = onRequest(
  { region: "us-central1", secrets: ["PULSO_INGEST_TOKEN"] },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

    // ── Auth ─────────────────────────────────────────────────────────────────
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.substring(7) : null;
    if (!token || token !== process.env.PULSO_INGEST_TOKEN) { res.status(401).send("Unauthorized"); return; }

    const event = req.body;
    if (!event || event.version !== "v1" || !event.event_id) { res.status(400).send("Invalid Payload"); return; }

    const WORKSPACE_ID = "felipe_dutra";
    const BASE = `workspaces/${WORKSPACE_ID}`;

    try {
      // ── Dedupe check ───────────────────────────────────────────────────────
      const ref = db.collection(`${BASE}/pulso_ingestion_events`).doc(event.event_id);
      const existing = await ref.get();
      if (existing.exists) { res.status(200).json({ status: "duplicate" }); return; }

      const ts = admin.firestore.FieldValue.serverTimestamp();
      const p  = event.payload || {};
      const eventTitle = p.title || p.summary || p.message || p.topic || event.event_type || "Ingestão externa";

      // ── Normalize Area and Project Refs ────────────────────────────────────
      const areaRef = event.areaRef ?? event.area_ref ?? 
                     event.context?.areaRef ?? event.context?.area_ref ?? 
                     p.areaRef ?? p.area_ref ?? null;
      
      const projectRef = event.projectRef ?? event.project_ref ?? 
                        event.context?.projectRef ?? event.context?.project_ref ?? 
                        p.projectRef ?? p.project_ref ?? null;

      // ── 1. Save raw ingestion event ────────────────────────────────────────
      await ref.set({
        ...event,
        areaRef,
        projectRef,
        ingestionStatus: "received",
        createdAt:       ts,
        updatedAt:       ts,
        originLabel:     "OpenClaw",
      });

      // ── 2. Audit event (Barramento / Outbox) with full envelope ────────────
      await db.collection(`${BASE}/pulso_events`).add({
        eventType:       "ingestion_received",
        entityType:      "ingestion",
        entityRef:       event.event_id,
        areaRef,
        projectRef,
        actorType:       event.actor?.type || "agent",
        actorRef:        event.actor?.id   || "openclaw",
        origin:          "openclaw",
        createdAt:       ts,
        outboxStatus:    "pending",
        payloadSummary:  eventTitle,
        payloadSnapshot: event.payload || {},
        // OpenClaw envelope fields (rendered in UI drawer)
        ocEventType:  event.event_type  || null,
        ocDedupeKey:  event.dedupe_key  || null,
        ocOccurredAt: event.occurred_at || null,
        ocSource:     event.source      || null,
        ocActor:      event.actor       || null,
        ocContext:    event.context     || null,
        ocTitle:      eventTitle,
      });

      // ── 3. Route alert → pulso_alerts so Health Center shows it ───────────
      if (event.event_type === "alert") {
        const alertId = `alert_oc_${event.event_id}`;
        await db.collection(`${BASE}/pulso_alerts`).doc(alertId).set({
          id:          alertId,
          slug:        alertId,
          name:        p.title   || "Alerta OpenClaw",
          description: p.message || p.summary || eventTitle,
          severity:    p.severity || "medium",
          status:      p.status   || "open",
          priority:    p.severity === "critical" ? "critical" : p.severity === "high" ? "high" : "medium",
          tags:        ["openclaw", ...(event.source?.agent ? [event.source.agent] : [])],
          areaRef,
          projectRef,
          agentRef:    event.actor?.id || "openclaw",
          notes:       `Recebido via OpenClaw. event_id: ${event.event_id}. dedupe_key: ${event.dedupe_key || "--"}`,
          createdAt:   ts,
          updatedAt:   ts,
        });
      }

      res.status(201).json({ status: "success", event_id: event.event_id });
    } catch (e) {
      console.error("Ingestion Error:", e);
      res.status(500).send("Internal Error");
    }
  }
);
