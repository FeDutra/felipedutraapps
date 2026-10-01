import { onRequest } from "firebase-functions/v2/https";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  hashDownloadEmail,
  isDownloadCooldownActive,
  isMusicOcreOriginAllowed,
  normalizeDownloadEmail,
  sanitizeDownloadName,
  sanitizeDownloadSource,
  validateDownloadEmail
} from "./core";
import type { MusicOcreDownloadRequest } from "./types";

const WORKSPACE_ID = "felipe_dutra";
const DOWNLOADS_COLLECTION = `workspaces/${WORKSPACE_ID}/music_ocre_downloads`;
const NOTICE_VERSION = "music-ocre-download-v1";
const GENERIC_SUCCESS = {
  status: "ok",
  message: "download liberado"
};

export const musicOcreDownloadApi = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    const origin = req.headers.origin;

    if (req.method === "OPTIONS") {
      if (!isMusicOcreOriginAllowed(origin)) {
        res.status(403).json({ error: "Origin not allowed" });
        return;
      }
      res.setHeader("Access-Control-Allow-Origin", origin as string);
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Max-Age", "86400");
      res.status(204).end();
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    if (!isMusicOcreOriginAllowed(origin)) {
      res.status(403).json({ error: "Origin not allowed" });
      return;
    }

    res.setHeader("Access-Control-Allow-Origin", origin as string);
    res.setHeader("Access-Control-Allow-Methods", "POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Vary", "Origin");
    res.setHeader("Cache-Control", "no-store");

    const contentLength = Number(req.headers["content-length"] || 0);
    if (contentLength > 8_192) {
      res.status(413).json({ error: "Payload too large" });
      return;
    }

    const body = (req.body || {}) as MusicOcreDownloadRequest;

    // Bots preenchem este campo visualmente oculto. A resposta permanece genérica
    // para não transformar o honeypot em um oráculo.
    if (typeof body.company === "string" && body.company.trim().length > 0) {
      res.status(200).json(GENERIC_SUCCESS);
      return;
    }

    if (body.action !== "register_download") {
      res.status(400).json({ error: "Ação inválida." });
      return;
    }

    const noticeAccepted = body.noticeAccepted === true || body.noticeAccepted === "true";
    if (!noticeAccepted) {
      res.status(400).json({ error: "Confirme a informação sobre o uso dos dados." });
      return;
    }

    const name = sanitizeDownloadName(body.name);
    if (name.length < 2) {
      res.status(400).json({ error: "Informe seu nome." });
      return;
    }

    if (!validateDownloadEmail(body.email)) {
      res.status(400).json({ error: "Informe um e-mail válido." });
      return;
    }

    const email = normalizeDownloadEmail(body.email);
    const source = sanitizeDownloadSource(body.source);
    const ref = getFirestore().collection(DOWNLOADS_COLLECTION).doc(hashDownloadEmail(email));

    try {
      await getFirestore().runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        const existing = snapshot.data();
        const cooldownActive = isDownloadCooldownActive(existing?.lastDownloadedAt);

        if (!snapshot.exists) {
          transaction.create(ref, {
            name,
            email,
            source,
            purpose: "ep_download",
            release: "PULSAO_EP_2016",
            downloadCount: 1,
            firstDownloadedAt: FieldValue.serverTimestamp(),
            lastDownloadedAt: FieldValue.serverTimestamp(),
            noticeAcceptedAt: FieldValue.serverTimestamp(),
            noticeVersion: NOTICE_VERSION,
            marketingConsent: false,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });
          return;
        }

        transaction.update(ref, {
          name,
          source,
          lastDownloadedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          noticeAcceptedAt: FieldValue.serverTimestamp(),
          noticeVersion: NOTICE_VERSION,
          marketingConsent: false,
          ...(!cooldownActive ? { downloadCount: FieldValue.increment(1) } : {})
        });
      });

      console.log("[music-ocre-download] download registered", hashDownloadEmail(email).slice(0, 10));
      res.status(200).json(GENERIC_SUCCESS);
    } catch (error: any) {
      console.error("[music-ocre-download] registration failed", error?.code || "UNKNOWN");
      res.status(500).json({ error: "Não foi possível liberar o download agora. Tente novamente." });
    }
  }
);
