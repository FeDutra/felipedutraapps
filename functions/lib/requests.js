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
exports.pulsoRequests = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
/**
 * Sanitizes an object by removing undefined values
 */
const sanitize = (obj) => {
    const result = {};
    Object.keys(obj).forEach((key) => {
        const val = obj[key];
        if (val !== undefined) {
            if (Array.isArray(val)) {
                result[key] = val.filter((v) => v !== undefined);
            }
            else {
                result[key] = val;
            }
        }
    });
    return result;
};
const slugify = (text) => {
    if (!text)
        return "";
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
};
exports.pulsoRequests = (0, https_1.onRequest)({ region: "us-central1", secrets: ["PULSO_INGEST_TOKEN"] }, async (req, res) => {
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
            const { limit = "20", requestType, status } = req.query;
            let query = db.collection(BASE);
            query = query.where("archived", "==", false);
            if (status) {
                query = query.where("status", "==", status);
            }
            else {
                query = query.where("status", "in", ["requested", "queued_for_openclaw"]);
            }
            if (requestType)
                query = query.where("requestType", "==", requestType);
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
                if (!docSnap.exists)
                    return { status: 404, message: "Request not found" };
                const data = docSnap.data();
                if (data.status !== "requested" && data.status !== "queued_for_openclaw") {
                    return { status: 409, message: `Request is in status ${data.status}` };
                }
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
            const requestData = docSnap.data();
            const ts = admin.firestore.FieldValue.serverTimestamp();
            // ── MATERIALIZATION DISPATCHER ───────────────────────────────────────
            const materialize = async () => {
                const type = requestData.requestType;
                const payload = requestData.payload || {};
                let matResult = { ok: true, action: "created", summary: "Entidade materializada." };
                try {
                    switch (type) {
                        case "register_person": {
                            if (!payload.name)
                                return { ok: false, action: "needs_clarification", missingFields: ["name"], summary: "Nome é obrigatório." };
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
                            if (!payload.name)
                                return { ok: false, action: "needs_clarification", missingFields: ["name"], summary: "Nome é obrigatório." };
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
                            if (!title)
                                return { ok: false, action: "needs_clarification", missingFields: ["title"], summary: "Título é obrigatório." };
                            const taskId = `task_${Date.now()}`;
                            const base = `workspaces/${WORKSPACE_ID}/pulso_tasks`;
                            await db.collection(base).doc(taskId).set(sanitize({
                                id: taskId, name: title, slug: slugify(title), status: "new",
                                priority: payload.priority || requestData.priority || "medium",
                                areaRef: requestData.areaRef || null, projectRef: requestData.projectRef || null,
                                notes: payload.notes || payload.description || requestData.summary || null,
                                ownerRefs: requestData.requestedBy ? [requestData.requestedBy] : [], createdAt: ts, updatedAt: ts, archived: false
                            }));
                            return { ...matResult, entityType: "task", entityRef: taskId, entityPath: `${base}/${taskId}` };
                        }
                        case "register_decision": {
                            if (!payload.decision)
                                return { ok: false, action: "needs_clarification", missingFields: ["decision"], summary: "Conteúdo da decisão é obrigatório." };
                            const decisionId = `dec_${Date.now()}`;
                            const base = `workspaces/${WORKSPACE_ID}/pulso_decisions`;
                            await db.collection(base).doc(decisionId).set(sanitize({
                                id: decisionId, name: payload.title || `Decisão: ${payload.decision.substring(0, 30)}...`,
                                slug: slugify(payload.title || decisionId), decision: payload.decision,
                                context: payload.context || requestData.summary || null,
                                status: "active", priority: requestData.priority || "medium",
                                areaRef: requestData.areaRef || null, projectRef: requestData.projectRef || null,
                                takenByRefs: requestData.requestedBy ? [requestData.requestedBy] : [], createdAt: ts, updatedAt: ts
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
                            if (!payload.name)
                                return { ok: false, action: "needs_clarification", missingFields: ["name"], summary: "Nome do projeto é obrigatório." };
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
                            if (!payload.name)
                                return { ok: false, action: "needs_clarification", missingFields: ["name"], summary: "Nome da área é obrigatório." };
                            if (payload.trusted !== true) {
                                return { ok: true, action: "needs_approval", summary: "Criação de Área Estrutural requer aprovação de governança humana prévia." };
                            }
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
                        // ── MATURIDADE OPERACIONAL: PESSOAS ────────────────────────────
                        case "update_person":
                        case "archive_person":
                        case "link_person_to_project":
                        case "unlink_person_from_project":
                        case "link_person_to_area":
                        case "unlink_person_from_area": {
                            const pBase = `workspaces/${WORKSPACE_ID}/pulso_people`;
                            let personId = payload.personRef || requestData.personRef;
                            if (!personId && payload.name) {
                                personId = `person_${slugify(payload.name)}`;
                            }
                            if (!personId && payload.slug) {
                                personId = `person_${payload.slug}`;
                            }
                            if (!personId) {
                                return { ok: false, action: "needs_clarification", missingFields: ["personRef"], summary: "personRef ou name/slug obrigatório para resolução." };
                            }
                            const pRef = db.collection(pBase).doc(personId);
                            const pSnap = await pRef.get();
                            if (!pSnap.exists) {
                                return { ok: false, action: "needs_clarification", missingFields: ["personRef"], summary: `Pessoa não encontrada: ${personId}` };
                            }
                            let patchData = { updatedAt: ts };
                            const reason = payload.reason || payload.notes || requestData.summary;
                            if (reason)
                                patchData.notes = reason;
                            if (type === "update_person") {
                                const patch = payload.patch || payload;
                                const allowedKeys = ["name", "role", "relationshipToFe", "importance", "status", "areaRef", "projectRef", "notes"];
                                allowedKeys.forEach(k => {
                                    if (patch[k] !== undefined)
                                        patchData[k] = patch[k];
                                });
                            }
                            else if (type === "archive_person") {
                                patchData.archived = true;
                                patchData.status = "inactive";
                            }
                            else if (type === "link_person_to_project") {
                                const projRef = payload.projectRef || requestData.projectRef;
                                if (!projRef)
                                    return { ok: false, action: "needs_clarification", missingFields: ["projectRef"], summary: "projectRef obrigatório para vínculo." };
                                patchData.projectRef = projRef;
                            }
                            else if (type === "unlink_person_from_project") {
                                patchData.projectRef = null;
                            }
                            else if (type === "link_person_to_area") {
                                const aRef = payload.areaRef || requestData.areaRef;
                                if (!aRef)
                                    return { ok: false, action: "needs_clarification", missingFields: ["areaRef"], summary: "areaRef obrigatório para vínculo." };
                                patchData.areaRef = aRef;
                            }
                            else if (type === "unlink_person_from_area") {
                                patchData.areaRef = null;
                            }
                            await pRef.update(sanitize(patchData));
                            return { ...matResult, action: "updated", entityType: "person", entityRef: personId, entityPath: `${pBase}/${personId}`, patch: patchData };
                        }
                        // ── MATURIDADE OPERACIONAL: PROJETOS ───────────────────────────
                        case "update_project":
                        case "archive_project":
                        case "change_project_status":
                        case "change_project_priority":
                        case "link_project_to_area": {
                            const prjBase = `workspaces/${WORKSPACE_ID}/pulso_projects`;
                            const projectId = payload.projectRef || requestData.projectRef;
                            if (!projectId) {
                                return { ok: false, action: "needs_clarification", missingFields: ["projectRef"], summary: "projectRef obrigatório para operação em projeto." };
                            }
                            const prjRef = db.collection(prjBase).doc(projectId);
                            const prjSnap = await prjRef.get();
                            if (!prjSnap.exists) {
                                return { ok: false, action: "needs_clarification", missingFields: ["projectRef"], summary: `Projeto não encontrado: ${projectId}` };
                            }
                            let patchData = { updatedAt: ts };
                            if (type === "update_project") {
                                const patch = payload.patch || payload;
                                const allowedKeys = ["name", "status", "stage", "priority", "objective", "areaRef", "nextStep", "riskSummary"];
                                allowedKeys.forEach(k => {
                                    if (patch[k] !== undefined)
                                        patchData[k] = patch[k];
                                });
                            }
                            else if (type === "archive_project") {
                                patchData.archived = true;
                                patchData.status = "archived";
                            }
                            else if (type === "change_project_status") {
                                if (!payload.status)
                                    return { ok: false, action: "needs_clarification", missingFields: ["status"], summary: "status obrigatório." };
                                patchData.status = payload.status;
                            }
                            else if (type === "change_project_priority") {
                                if (!payload.priority)
                                    return { ok: false, action: "needs_clarification", missingFields: ["priority"], summary: "priority obrigatório." };
                                patchData.priority = payload.priority;
                            }
                            else if (type === "link_project_to_area") {
                                if (!payload.areaRef && !requestData.areaRef)
                                    return { ok: false, action: "needs_clarification", missingFields: ["areaRef"], summary: "areaRef obrigatório." };
                                patchData.areaRef = payload.areaRef || requestData.areaRef;
                            }
                            await prjRef.update(sanitize(patchData));
                            return { ...matResult, action: "updated", entityType: "project", entityRef: projectId, entityPath: `${prjBase}/${projectId}`, patch: patchData };
                        }
                        // ── MATURIDADE OPERACIONAL: TAREFAS ────────────────────────────
                        case "update_task":
                        case "complete_task":
                        case "archive_task":
                        case "link_task_to_project":
                        case "link_task_to_area": {
                            const tBase = `workspaces/${WORKSPACE_ID}/pulso_tasks`;
                            let taskId = payload.taskRef || requestData.taskRef;
                            if (!taskId && payload.title) {
                                const tQuery = await db.collection(tBase).where("slug", "==", slugify(payload.title)).limit(1).get();
                                if (!tQuery.empty)
                                    taskId = tQuery.docs[0].id;
                            }
                            if (!taskId) {
                                return { ok: false, action: "needs_clarification", missingFields: ["taskRef"], summary: "taskRef ou title resolvível obrigatório." };
                            }
                            const tRef = db.collection(tBase).doc(taskId);
                            const tSnap = await tRef.get();
                            if (!tSnap.exists) {
                                return { ok: false, action: "needs_clarification", missingFields: ["taskRef"], summary: `Tarefa não encontrada: ${taskId}` };
                            }
                            let patchData = { updatedAt: ts };
                            if (type === "update_task") {
                                const patch = payload.patch || payload;
                                const allowedKeys = ["name", "status", "priority", "notes", "areaRef", "projectRef", "dueAt", "completedAt", "archived"];
                                allowedKeys.forEach(k => {
                                    if (patch[k] !== undefined)
                                        patchData[k] = patch[k];
                                });
                            }
                            else if (type === "complete_task") {
                                patchData.status = "completed";
                                patchData.completedAt = ts;
                            }
                            else if (type === "archive_task") {
                                patchData.archived = true;
                            }
                            else if (type === "link_task_to_project") {
                                const projRef = payload.projectRef || requestData.projectRef;
                                if (!projRef)
                                    return { ok: false, action: "needs_clarification", missingFields: ["projectRef"], summary: "projectRef obrigatório." };
                                patchData.projectRef = projRef;
                            }
                            else if (type === "link_task_to_area") {
                                const aRef = payload.areaRef || requestData.areaRef;
                                if (!aRef)
                                    return { ok: false, action: "needs_clarification", missingFields: ["areaRef"], summary: "areaRef obrigatório." };
                                patchData.areaRef = aRef;
                            }
                            await tRef.update(sanitize(patchData));
                            return { ...matResult, action: "updated", entityType: "task", entityRef: taskId, entityPath: `${tBase}/${taskId}`, patch: patchData };
                        }
                        // ── MATURIDADE OPERACIONAL: FONTES ─────────────────────────────
                        case "update_source":
                        case "archive_source":
                        case "link_source_to_project":
                        case "unlink_source_from_project":
                        case "link_source_to_area":
                        case "unlink_source_from_area": {
                            const sBase = `workspaces/${WORKSPACE_ID}/pulso_sources`;
                            let sourceId = payload.sourceRef || requestData.sourceRef;
                            if (!sourceId && payload.name)
                                sourceId = `source_${slugify(payload.name)}`;
                            if (!sourceId)
                                return { ok: false, action: "needs_clarification", missingFields: ["sourceRef"], summary: "sourceRef ou name obrigatório." };
                            const sRef = db.collection(sBase).doc(sourceId);
                            const sSnap = await sRef.get();
                            if (!sSnap.exists)
                                return { ok: false, action: "needs_clarification", missingFields: ["sourceRef"], summary: `Fonte não encontrada: ${sourceId}` };
                            let patchData = { updatedAt: ts };
                            if (type === "update_source") {
                                const patch = payload.patch || payload;
                                const allowedKeys = ["name", "type", "priority", "url", "notes", "areaRef", "projectRef", "status"];
                                allowedKeys.forEach(k => {
                                    if (patch[k] !== undefined)
                                        patchData[k] = patch[k];
                                });
                            }
                            else if (type === "archive_source") {
                                patchData.archived = true;
                                patchData.status = "inactive";
                            }
                            else if (type === "link_source_to_project") {
                                const projRef = payload.projectRef || requestData.projectRef;
                                if (!projRef)
                                    return { ok: false, action: "needs_clarification", missingFields: ["projectRef"], summary: "projectRef obrigatório." };
                                patchData.projectRef = projRef;
                            }
                            else if (type === "unlink_source_from_project") {
                                patchData.projectRef = null;
                            }
                            else if (type === "link_source_to_area") {
                                const aRef = payload.areaRef || requestData.areaRef;
                                if (!aRef)
                                    return { ok: false, action: "needs_clarification", missingFields: ["areaRef"], summary: "areaRef obrigatório." };
                                patchData.areaRef = aRef;
                            }
                            else if (type === "unlink_source_from_area") {
                                patchData.areaRef = null;
                            }
                            await sRef.update(sanitize(patchData));
                            return { ...matResult, action: "updated", entityType: "source", entityRef: sourceId, entityPath: `${sBase}/${sourceId}`, patch: patchData };
                        }
                        case "create_agent": {
                            return { ok: true, action: "needs_approval", summary: "Blueprint de agente criado. Requer aprovação humana." };
                        }
                        default:
                            return { ok: true, action: "skipped", summary: "Sem materialização estrutural exigida." };
                    }
                }
                catch (e) {
                    console.error("Materialization Error:", e);
                    return { ok: false, action: "failed", summary: `Erro: ${e.message}` };
                }
            };
            const matResult = await materialize();
            if (matResult.action === "needs_clarification") {
                const clarifObj = { question: matResult.summary, missingFields: matResult.missingFields || [] };
                await docRef.update(sanitize({
                    status: "needs_clarification",
                    result: clarifObj,
                    updatedAt: ts
                }));
                res.status(200).json({ status: "needs_clarification", result: clarifObj });
                return;
            }
            const isFailed = matResult.action === "failed" || matResult.ok === false;
            const finalStatus = matResult.action === "needs_approval" ? "needs_approval" : isFailed ? "failed" : "completed";
            const finalResultObj = sanitize({
                ...(result || {}),
                action: matResult.action || (finalStatus === "completed" ? "updated" : "failed"),
                entityType: matResult.entityType || null,
                entityRef: matResult.entityRef || null,
                entityPath: matResult.entityPath || null,
                matResult,
            });
            await docRef.update(sanitize({
                status: finalStatus,
                result: finalResultObj,
                error: isFailed ? matResult.summary || "Erro na materialização" : admin.firestore.FieldValue.delete(),
                emittedEvents: emittedEvents || null,
                pulsoEventId: pulsoEventId || null,
                processedAt: ts,
                updatedAt: ts,
            }));
            res.status(200).json({
                status: finalStatus,
                result: finalResultObj,
                error: isFailed ? matResult.summary || "Erro na materialização" : null
            });
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
            if (!requestId) {
                res.status(400).send("Missing requestId");
                return;
            }
            const ts = admin.firestore.FieldValue.serverTimestamp();
            await db.collection(BASE).doc(requestId).update(sanitize({
                status: "needs_clarification",
                result: { question: question || "Necessário esclarecimento", missingFields: missingFields || [] },
                updatedAt: ts,
            }));
            res.status(200).send("needs_clarification");
            return;
        }
        // ── POST /needs-approval ───────────────────────────────────────────────
        if (req.method === "POST" && path === "/needs-approval") {
            const { requestId, reason, blueprint } = req.body;
            if (!requestId) {
                res.status(400).send("Missing requestId");
                return;
            }
            const ts = admin.firestore.FieldValue.serverTimestamp();
            await db.collection(BASE).doc(requestId).update(sanitize({
                status: "needs_approval",
                result: { reason: reason || "Requer aprovação humana estrutural", blueprint: blueprint || null },
                updatedAt: ts,
            }));
            res.status(200).send("needs_approval");
            return;
        }
        // ── POST /create ───────────────────────────────────────────────────────
        if (req.method === "POST" && (path === "/create" || path === "/requests/create")) {
            const data = req.body;
            const ALLOWED_REQUEST_TYPES = [
                "refresh_state", "register_source", "register_person", "create_task",
                "register_decision", "create_alert", "sync_area", "create_agent",
                "create_project", "create_area", "update_person", "archive_person",
                "link_person_to_project", "unlink_person_from_project", "link_person_to_area",
                "unlink_person_from_area", "update_project", "archive_project",
                "change_project_status", "change_project_priority", "link_project_to_area",
                "update_task", "complete_task", "archive_task", "link_task_to_project",
                "link_task_to_area", "update_source", "archive_source", "link_source_to_project",
                "unlink_source_from_project", "link_source_to_area", "unlink_source_from_area"
            ];
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
                const data = docSnap.data();
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
    }
    catch (e) {
        console.error("Requests Bridge Error:", e);
        res.status(500).send("Internal Error");
    }
});
//# sourceMappingURL=requests.js.map