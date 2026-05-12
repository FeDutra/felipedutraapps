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

const slugify = (text: string) => {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
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

    const rawPath = req.path.replace(/\/$/, "");
    // Remove the bridge prefix if present (e.g. from Hosting rewrite)
    const path = rawPath.replace("/api/pulso/requests", "") || "";

    try {
      // ── GET /pending ──────────────────────────────────────────────────────
      if (req.method === "GET" && (path === "/pending" || path === "")) {
        const { limit = "20", requestType, status = "requested" } = req.query;
        let query: admin.firestore.Query = db.collection(BASE);
        query = query.where("archived", "==", false);
        if (status) query = query.where("status", "==", status);
        if (requestType) query = query.where("requestType", "==", requestType);
        
        const snapshot = await query.limit(Number(limit)).get();
        const requests = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
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
          if (data.status !== "requested") return { status: 409, message: `Request is in status ${data.status}` };
          const ts = admin.firestore.FieldValue.serverTimestamp();
          transaction.update(docRef, { status: "running", processedBy, startedAt: ts, updatedAt: ts });
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

        const docRef = db.collection(BASE).doc(requestId);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
          res.status(404).send("Request not found");
          return;
        }

        const requestData = docSnap.data()!;
        const ts = admin.firestore.FieldValue.serverTimestamp();

        // ── MATERIALIZATION DISPATCHER ───────────────────────────────────────
        const materialize = async () => {
          const type = requestData.requestType;
          const payload = requestData.payload || {};
          let matResult: any = { ok: true, action: "created", summary: "Entidade materializada." };

          try {
            switch (type) {
              case "register_person": {
                if (!payload.name) return { ok: false, action: "needs_clarification", missingFields: ["name"], summary: "Nome é obrigatório." };
                const slug = slugify(payload.name);
                const personId = `person_${slug}`;
                const base = `workspaces/${WORKSPACE_ID}/pulso_people`;
                await db.collection(base).doc(personId).set(sanitize({
                  id: personId, slug, name: payload.name, role: payload.role || null,
                  relationshipToFe: payload.relationType || payload.relationshipToFe || null,
                  importance: payload.attentionLevel || payload.priority || "medium",
                  status: "active", areaRef: requestData.areaRef || null, projectRef: requestData.projectRef || null,
                  notes: payload.notes || null, createdAt: ts, updatedAt: ts, archived: false,
                  source: requestData.origin?.source || "openclaw"
                }), { merge: true });
                return { ...matResult, entityType: "person", entityRef: personId, entityPath: `${base}/${personId}` };
              }

              case "register_source": {
                if (!payload.name) return { ok: false, action: "needs_clarification", missingFields: ["name"], summary: "Nome é obrigatório." };
                const slug = slugify(payload.name);
                const sourceId = `source_${slug}`;
                const base = `workspaces/${WORKSPACE_ID}/pulso_sources`;
                await db.collection(base).doc(sourceId).set(sanitize({
                  id: sourceId, slug, name: payload.name, type: payload.type || "google_sheets",
                  system: payload.system || "external", status: "active",
                  priority: payload.relevance || payload.priority || "medium",
                  areaRef: requestData.areaRef || null, projectRef: requestData.projectRef || null,
                  url: payload.link || payload.url || null, notes: payload.role || payload.notes || null,
                  createdAt: ts, updatedAt: ts, archived: false, syncMode: "manual"
                }), { merge: true });
                return { ...matResult, entityType: "source", entityRef: sourceId, entityPath: `${base}/${sourceId}` };
              }

              case "create_task": {
                const title = payload.title || requestData.title;
                if (!title) return { ok: false, action: "needs_clarification", missingFields: ["title"], summary: "Título é obrigatório." };
                const taskId = `task_${Date.now()}`;
                const base = `workspaces/${WORKSPACE_ID}/pulso_tasks`;
                await db.collection(base).doc(taskId).set(sanitize({
                  id: taskId, name: title, slug: slugify(title), status: "new",
                  priority: payload.priority || requestData.priority || "medium",
                  areaRef: requestData.areaRef || null, projectRef: requestData.projectRef || null,
                  notes: payload.notes || payload.description || requestData.summary || null,
                  ownerRefs: [requestData.requestedBy], createdAt: ts, updatedAt: ts, archived: false
                }));
                return { ...matResult, entityType: "task", entityRef: taskId, entityPath: `${base}/${taskId}` };
              }

              case "register_decision": {
                if (!payload.decision) return { ok: false, action: "needs_clarification", missingFields: ["decision"], summary: "Conteúdo da decisão é obrigatório." };
                const decisionId = `dec_${Date.now()}`;
                const base = `workspaces/${WORKSPACE_ID}/pulso_decisions`;
                await db.collection(base).doc(decisionId).set(sanitize({
                  id: decisionId, name: payload.title || `Decisão: ${payload.decision.substring(0, 30)}...`,
                  slug: slugify(payload.title || decisionId), decision: payload.decision,
                  context: payload.context || requestData.summary || null,
                  status: "active", priority: requestData.priority || "medium",
                  areaRef: requestData.areaRef || null, projectRef: requestData.projectRef || null,
                  takenByRefs: [requestData.requestedBy], createdAt: ts, updatedAt: ts
                }));
                return { ...matResult, entityType: "decision", entityRef: decisionId, entityPath: `${base}/${decisionId}` };
              }

              case "create_alert": {
                const alertId = `alert_${Date.now()}`;
                const base = `workspaces/${WORKSPACE_ID}/pulso_alerts`;
                await db.collection(base).doc(alertId).set(sanitize({
                  id: alertId, name: payload.title || requestData.title || "Alerta Operacional",
                  slug: slugify(payload.title || alertId), status: "active",
                  priority: payload.severity || requestData.priority || "medium",
                  description: payload.description || requestData.summary || null,
                  areaRef: requestData.areaRef || null, projectRef: requestData.projectRef || null,
                  createdAt: ts, updatedAt: ts
                }));
                return { ...matResult, entityType: "alert", entityRef: alertId, entityPath: `${base}/${alertId}` };
              }

              case "create_project": {
                if (!payload.name) return { ok: false, action: "needs_clarification", missingFields: ["name"], summary: "Nome do projeto é obrigatório." };
                const slug = slugify(payload.name);
                const projectId = `proj_${slug}`;
                const base = `workspaces/${WORKSPACE_ID}/pulso_projects`;
                await db.collection(base).doc(projectId).set(sanitize({
                  id: projectId, slug, name: payload.name, status: "new", stage: "captura",
                  priority: payload.priority || "medium", objective: payload.objective || null,
                  areaRef: requestData.areaRef || null, createdAt: ts, updatedAt: ts
                }), { merge: true });
                return { ...matResult, entityType: "project", entityRef: projectId, entityPath: `${base}/${projectId}` };
              }

              case "create_area": {
                if (!payload.name) return { ok: false, action: "needs_clarification", missingFields: ["name"], summary: "Nome da área é obrigatório." };
                const slug = slugify(payload.name);
                const areaId = `area_${slug}`;
                const base = `workspaces/${WORKSPACE_ID}/pulso_areas`;
                await db.collection(base).doc(areaId).set(sanitize({
                  id: areaId, slug, name: payload.name, type: payload.type || "business",
                  status: "active", priority: payload.priority || "medium", importance: payload.priority || "medium",
                  createdAt: ts, updatedAt: ts
                }), { merge: true });
                return { ...matResult, entityType: "area", entityRef: areaId, entityPath: `${base}/${areaId}` };
              }

              case "create_agent": {
                return { ok: true, action: "needs_approval", summary: "Blueprint de agente criado. Requer aprovação humana." };
              }

              default:
                return { ok: true, action: "skipped", summary: "Sem materialização estrutural exigida." };
            }
          } catch (e: any) {
            console.error("Materialization Error:", e);
            return { ok: false, action: "failed", summary: `Erro: ${e.message}` };
          }
        };

        const matResult = await materialize();

        if (matResult.action === "needs_clarification") {
          await docRef.update(sanitize({
            status: "needs_clarification",
            result: { question: matResult.summary, missingFields: matResult.missingFields || [] },
            updatedAt: ts
          }));
          res.status(200).send("needs_clarification");
          return;
        }

        const finalStatus = matResult.action === "needs_approval" ? "needs_approval" : "completed";
        await docRef.update(sanitize({
          status: finalStatus,
          result: { ...(result || {}), matResult },
          emittedEvents: emittedEvents || null,
          pulsoEventId: pulsoEventId || null,
          processedAt: ts,
          updatedAt: ts,
        }));
        res.status(200).send(finalStatus);
        return;
      }

      // ── POST /fail ─────────────────────────────────────────────────────────
      if (req.method === "POST" && path === "/fail") {
        const { requestId, error, recoverable, nextSuggestedAction } = req.body;
        if (!requestId) { res.status(400).send("Missing requestId"); return; }
        const ts = admin.firestore.FieldValue.serverTimestamp();
        await db.collection(BASE).doc(requestId).update(sanitize({
          status: "failed", error: error || "Unknown error",
          recoverable: recoverable ?? false, nextSuggestedAction: nextSuggestedAction || null,
          processedAt: ts, updatedAt: ts,
        }));
        res.status(200).send("failed");
        return;
      }

      // ── POST /needs-clarification ──────────────────────────────────────────
      if (req.method === "POST" && path === "/needs-clarification") {
        const { requestId, question, missingFields } = req.body;
        if (!requestId) { res.status(400).send("Missing requestId"); return; }
        const ts = admin.firestore.FieldValue.serverTimestamp();
        await db.collection(BASE).doc(requestId).update(sanitize({
          status: "needs_clarification",
          result: { question: question || "Necessário esclarecimento", missingFields: missingFields || [] },
          updatedAt: ts,
        }));
        res.status(200).send("needs_clarification");
        return;
      }

      // ── POST /create ───────────────────────────────────────────────────────
      if (req.method === "POST" && (path === "/create" || path === "/requests/create")) {
        const data = req.body;
        const ALLOWED_REQUEST_TYPES = ["refresh_state", "register_source", "register_person", "create_task", "register_decision", "create_alert", "sync_area", "create_agent", "create_project", "create_area"];
        if (!data.requestType || !ALLOWED_REQUEST_TYPES.includes(data.requestType)) {
          res.status(400).send(`Invalid requestType.`);
          return;
        }
        const ts = admin.firestore.FieldValue.serverTimestamp();
        if (data.dedupeKey) {
          const existingQuery = await db.collection(BASE).where("dedupeKey", "==", data.dedupeKey).where("status", "in", ["requested", "running", "needs_clarification"]).limit(1).get();
          if (!existingQuery.empty) {
            const existingDoc = existingQuery.docs[0];
            res.status(200).json({ status: "duplicate", requestId: existingDoc.id });
            return;
          }
        }
        const requestId = data.requestId || `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        await db.collection(BASE).doc(requestId).set(sanitize({
          ...data, id: requestId, status: "requested", archived: false, requestedAt: ts, updatedAt: ts,
          createdByType: data.createdByType || "agent", createdById: data.createdById || "lotus",
        }));
        res.status(201).json({ status: "created", requestId });
        return;
      }

      // ── GET /:id ───────────────────────────────────────────────────────────
      if (req.method === "GET" && path.startsWith("/") && path !== "/pending") {
        const id = path.replace(/^\/requests\//, "").replace(/^\//, "");
        if (id && id.startsWith("req_")) {
          const docSnap = await db.collection(BASE).doc(id).get();
          if (!docSnap.exists) {
            res.status(404).json({ error: "Request not found" });
            return;
          }
          const data = docSnap.data()!;
          res.status(200).json({
            ...data,
            id: docSnap.id,
            requestedAt: data.requestedAt?.toDate()?.toISOString(),
            updatedAt: data.updatedAt?.toDate()?.toISOString(),
            startedAt: data.startedAt?.toDate()?.toISOString(),
            processedAt: data.processedAt?.toDate()?.toISOString(),
          });
          return;
        }
      }

      res.status(404).send(`Endpoint not found: ${path}`);
    } catch (e) {
      console.error("Requests Bridge Error:", e);
      res.status(500).send("Internal Error");
    }
  }
);
