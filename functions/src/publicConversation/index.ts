import { onRequest } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import * as crypto from "node:crypto";
import {
  isAllowedOrigin,
  validateAndSanitizeMessage,
  sanitizeDisplayName,
  isHoneypotTriggered,
  generateConversationId,
  generateSessionToken,
  hashSessionToken,
  verifySessionToken,
  deriveOpaqueKey,
  deriveContextId,
  deriveOpenClawSessionKey,
  evaluateRateLimit,
  mapWorkerStatus,
  extractSanitizedResponseText
} from "./core";
import type {
  MessageRequestBody,
  PublicConversationDoc
} from "./types";

const WORKSPACE_ID = "felipe_dutra";
const CONVERSATIONS_COLLECTION = `workspaces/${WORKSPACE_ID}/public_conversations`;
const REQUESTS_COLLECTION = `workspaces/${WORKSPACE_ID}/pulso_requests`;

class CustomHttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "CustomHttpError";
  }
}

export const publicConversationApi = onRequest(
  {
    region: "us-central1"
  },
  async (req, res) => {
    // ── 1. Security Headers & Cache ──────────────────────────────────────────
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "default-src 'none'");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

    // ── 2. Origin & CORS Handling ──────────────────────────────────────────
    const origin = req.headers.origin;

    if (req.method === "OPTIONS") {
      if (origin && isAllowedOrigin(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.setHeader("Access-Control-Max-Age", "86400");
        res.status(204).end();
        return;
      }
      res.status(403).json({ error: "Origin not allowed" });
      return;
    }

    if (req.method === "POST") {
      // POST requires authorized Origin: reject absence or invalid origin
      if (!origin || !isAllowedOrigin(origin)) {
        res.status(403).json({ error: "Origin not allowed" });
        return;
      }
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "POST");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    } else if (req.method === "GET") {
      if (origin) {
        if (!isAllowedOrigin(origin)) {
          res.status(403).json({ error: "Origin not allowed" });
          return;
        }
        res.setHeader("Access-Control-Allow-Origin", origin);
      }
      res.setHeader("Access-Control-Allow-Methods", "GET");
    } else {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const db = getFirestore();

    // ── 3. GET: Check Conversation / Request Status ─────────────────────────
    if (req.method === "GET") {
      const action = req.query.action as string | undefined;
      const conversationId = req.query.conversationId as string | undefined;
      const sessionToken = req.query.sessionToken as string | undefined;
      const requestId = req.query.requestId as string | undefined;

      if (action !== "status" || !conversationId || !sessionToken || !requestId) {
        res.status(400).json({
          error: "Requisição inválida. Parâmetros action=status, conversationId, sessionToken e requestId são obrigatórios."
        });
        return;
      }

      try {
        const convRef = db.collection(CONVERSATIONS_COLLECTION).doc(conversationId);
        const convSnap = await convRef.get();

        if (!convSnap.exists) {
          res.status(404).json({ error: "Conversa não encontrada." });
          return;
        }

        const convData = convSnap.data() as PublicConversationDoc;

        // Constant-time token verification
        if (!verifySessionToken(sessionToken, convData.tokenHash)) {
          res.status(403).json({ error: "Token de sessão inválido." });
          return;
        }

        // Verify request belongs to conversation
        const reqDocRef = db.collection(REQUESTS_COLLECTION).doc(requestId);
        const reqSnap = await reqDocRef.get();

        if (!reqSnap.exists) {
          res.status(404).json({ error: "Solicitação não encontrada." });
          return;
        }

        const reqData = reqSnap.data()!;
        if (reqData.conversationId !== conversationId) {
          res.status(403).json({ error: "A solicitação não pertence a esta conversa." });
          return;
        }

        const status = mapWorkerStatus(reqData.status);

        if (status === "success") {
          const responseText = extractSanitizedResponseText(reqData);
          res.status(200).json({
            status: "success",
            ...(responseText ? { responseText } : {})
          });
          return;
        }

        res.status(200).json({ status });
        return;
      } catch (err: any) {
        console.error("[publicConversationApi] Error checking status:", err?.message || err);
        res.status(500).json({ error: "Erro interno ao consultar status." });
        return;
      }
    }

    // ── 4. POST: Send Message / Start Conversation ──────────────────────────
    if (req.method === "POST") {
      const body = (req.body || {}) as MessageRequestBody;

      // Honeypot check: If bot filled the hidden website field, return silent success
      if (isHoneypotTriggered(body.website)) {
        console.warn("[publicConversationApi] Honeypot triggered, returning silent success");
        const dummyConvId = body.conversationId && typeof body.conversationId === "string"
          ? body.conversationId
          : generateConversationId();
        const dummyReqId = `req_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
        res.status(200).json({
          status: "queued",
          conversationId: dummyConvId,
          requestId: dummyReqId
        });
        return;
      }

      if (body.action !== "message") {
        res.status(400).json({ error: "Ação inválida. Apenas action='message' é permitida." });
        return;
      }

      const messageValidation = validateAndSanitizeMessage(body.message);
      if (!messageValidation.valid) {
        res.status(400).json({ error: messageValidation.error });
        return;
      }

      const message = messageValidation.message;
      const visitorName = sanitizeDisplayName(body.name);

      const hasConversationId =
        typeof body.conversationId === "string" && body.conversationId.trim().length > 0;

      // ── New Conversation ───────────────────────────────────────────────────
      if (!hasConversationId) {
        const conversationId = generateConversationId();
        const sessionToken = generateSessionToken();
        const tokenHash = hashSessionToken(sessionToken);
        const opaque = deriveOpaqueKey(conversationId);
        const requestId = `req_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

        const convRef = db.collection(CONVERSATIONS_COLLECTION).doc(conversationId);
        const reqRef = db.collection(REQUESTS_COLLECTION).doc(requestId);
        const ownershipRef = convRef.collection("requests").doc(requestId);

        try {
          const nowTs = FieldValue.serverTimestamp();

          const batch = db.batch();

          // 1. Create conversation record (storing only SHA-256 token hash)
          batch.set(convRef, {
            conversationId,
            tokenHash,
            createdAt: nowTs,
            updatedAt: nowTs,
            lastMessageAt: nowTs,
            messageCountHour: 1,
            hourWindowStart: nowTs,
            totalMessages: 1,
            status: "active",
            latestRequestId: requestId,
            visitorName: visitorName || null
          });

          // 2. Queue conversation command into pulso_requests
          batch.set(reqRef, {
            id: requestId,
            requestType: "conversation_command",
            status: "queued_for_openclaw",
            source: "fe_site_public",
            mode: "text",
            input: message,
            rawInput: message,
            contextId: deriveContextId(opaque),
            chatId: conversationId,
            conversationId: conversationId,
            context: {
              userName: visitorName || "Visitante",
              locale: "pt-BR",
              timezone: "America/Sao_Paulo",
              interface: "website_public",
              currentRoute: "/conversar",
              publicSurface: true
            },
            openclawSessionKey: deriveOpenClawSessionKey(opaque),
            runtimeSessionKey: deriveOpenClawSessionKey(opaque),
            handoff: {
              target: "openclaw",
              mode: "proposal_only"
            },
            archived: false,
            priority: "medium",
            publicSurface: true,
            requestedAt: nowTs,
            createdAt: nowTs,
            updatedAt: nowTs
          });

          // 3. Save request ownership reference under the conversation
          batch.set(ownershipRef, {
            requestId,
            conversationId,
            createdAt: nowTs,
            status: "queued"
          });

          await batch.commit();

          // Return sessionToken once!
          res.status(200).json({
            status: "queued",
            conversationId,
            sessionToken,
            requestId
          });
          return;
        } catch (err: any) {
          console.error("[publicConversationApi] Error creating new conversation:", err?.message || err);
          res.status(500).json({ error: "Erro interno ao iniciar conversa." });
          return;
        }
      }

      // ── Existing Conversation ─────────────────────────────────────────────
      const conversationId = body.conversationId!.trim();
      const sessionToken = body.sessionToken;

      if (!sessionToken || typeof sessionToken !== "string" || sessionToken.trim().length === 0) {
        res.status(401).json({ error: "Token de sessão não fornecido." });
        return;
      }

      const convRef = db.collection(CONVERSATIONS_COLLECTION).doc(conversationId);
      const requestId = `req_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const reqRef = db.collection(REQUESTS_COLLECTION).doc(requestId);
      const ownershipRef = convRef.collection("requests").doc(requestId);

      try {
        await db.runTransaction(async (transaction) => {
          const convSnap = await transaction.get(convRef);
          if (!convSnap.exists) {
            throw new CustomHttpError(404, "Conversa não encontrada.");
          }

          const convData = convSnap.data() as PublicConversationDoc;

          // Constant-time token verification
          if (!verifySessionToken(sessionToken, convData.tokenHash)) {
            throw new CustomHttpError(403, "Token de sessão inválido.");
          }

          if (convData.status === "blocked") {
            throw new CustomHttpError(403, "Conversa desativada.");
          }

          // Evaluate rate limit and cooldown
          const now = new Date();
          const rateEval = evaluateRateLimit({
            lastMessageAt: convData.lastMessageAt,
            messageCountHour: convData.messageCountHour,
            hourWindowStart: convData.hourWindowStart
          }, now);

          if (!rateEval.allowed) {
            if (rateEval.reason === "cooldown") {
              throw new CustomHttpError(429, "Aguarde alguns instantes antes de enviar outra mensagem.");
            }
            throw new CustomHttpError(429, "Limite de mensagens por hora atingido. Tente novamente mais tarde.");
          }

          const nowTs = FieldValue.serverTimestamp();
          const opaque = deriveOpaqueKey(conversationId);

          // Update conversation document
          const updateData: Record<string, any> = {
            lastMessageAt: nowTs,
            updatedAt: nowTs,
            messageCountHour: rateEval.messageCountHour,
            hourWindowStart: Timestamp.fromDate(rateEval.hourWindowStart),
            totalMessages: FieldValue.increment(1),
            latestRequestId: requestId
          };

          if (visitorName) {
            updateData.visitorName = visitorName;
          }

          transaction.update(convRef, updateData);

          // Queue new pulso_request
          transaction.set(reqRef, {
            id: requestId,
            requestType: "conversation_command",
            status: "queued_for_openclaw",
            source: "fe_site_public",
            mode: "text",
            input: message,
            rawInput: message,
            contextId: deriveContextId(opaque),
            chatId: conversationId,
            conversationId: conversationId,
            context: {
              userName: visitorName || convData.visitorName || "Visitante",
              locale: "pt-BR",
              timezone: "America/Sao_Paulo",
              interface: "website_public",
              currentRoute: "/conversar",
              publicSurface: true
            },
            openclawSessionKey: deriveOpenClawSessionKey(opaque),
            runtimeSessionKey: deriveOpenClawSessionKey(opaque),
            handoff: {
              target: "openclaw",
              mode: "proposal_only"
            },
            archived: false,
            priority: "medium",
            publicSurface: true,
            requestedAt: nowTs,
            createdAt: nowTs,
            updatedAt: nowTs
          });

          // Save ownership reference under the conversation
          transaction.set(ownershipRef, {
            requestId,
            conversationId,
            createdAt: nowTs,
            status: "queued"
          });
        });

        res.status(200).json({
          status: "queued",
          conversationId,
          requestId
        });
        return;
      } catch (err: any) {
        if (err instanceof CustomHttpError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        console.error("[publicConversationApi] Transaction error:", err?.message || err);
        // Do not leak internal Firestore paths or details
        res.status(500).json({ error: "Erro interno ao processar mensagem." });
        return;
      }
    }

    res.status(405).json({ error: "Method not allowed" });
  }
);
