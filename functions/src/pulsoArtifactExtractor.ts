/**
 * pulsoArtifactExtractor.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Cloud Function acionada por gatilho Firestore que escuta novos requests
 * na PULSO. Se houverem anexos pendentes de extração (status: processing_extraction),
 * invoca o Gemini Flash Multimodal para processá-los e gerar a representação textual.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";

const WORKSPACE_ID = "felipe_dutra";
const REQUESTS_PATH = `workspaces/${WORKSPACE_ID}/pulso_requests/{requestId}`;

// Inicialização segura do Gemini
let aiInstance: GoogleGenerativeAI | null = null;
function getAI(): GoogleGenerativeAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment secrets.");
    }
    aiInstance = new GoogleGenerativeAI(apiKey);
  }
  return aiInstance;
}

/**
 * Função utilitária para baixar um arquivo do Firebase Storage em formato buffer
 */
async function downloadFileFromStorage(storageRef: string): Promise<Buffer> {
  const bucket = admin.storage().bucket();
  const file = bucket.file(storageRef);
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`File not found in Storage: ${storageRef}`);
  }
  const [content] = await file.download();
  return content;
}

/**
 * Invoca o Gemini para descrever a imagem e extrair seu texto (OCR)
 */
async function processImageArtifact(buffer: Buffer, mimeType: string, filename: string) {
  const ai = getAI();
  const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

  const imagePart = {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType
    }
  };

  const prompt = 
    `Analise a imagem anexa ("${filename}"). Extraia todo o texto visível (OCR) com a máxima precisão de layout. ` +
    `Além disso, gere um resumo descritivo de 1 a 2 frases explicando o conteúdo funcional dessa imagem (tópicos, tabelas, dados nela contidos). ` +
    `Selecione de 2 a 4 trechos operacionais chaves (Ex: números de notas, datas, nomes próprios, valores).\n\n` +
    `Retorne a resposta estritamente no seguinte formato JSON:\n` +
    `{\n` +
    `  "summary": "resumo descritivo da imagem",\n` +
    `  "textExtracted": "texto completo extraído via OCR",\n` +
    `  "keyExcerpts": ["trecho 1", "trecho 2"]\n` +
    `}`;

  const result = await model.generateContent([imagePart, prompt]);
  const responseText = result.response.text();
  
  // Limpar possíveis markdown blocks da resposta do modelo
  const jsonText = responseText.replace(/```json|```/g, "").trim();
  return JSON.parse(jsonText);
}

/**
 * Processador principal da fila de extração de anexos
 */
async function runExtractionPipeline(requestId: string, data: any) {
  const db = admin.firestore();
  const docRef = db.collection(`workspaces/${WORKSPACE_ID}/pulso_requests`).doc(requestId);

  const attachments = data.attachments || [];
  const pendingExtraction = attachments.filter((a: any) => a.status === "processing_extraction");

  if (pendingExtraction.length === 0) {
    return;
  }

  logger.info(`🧪 Iniciando extração de ${pendingExtraction.length} artefato(s) para o request ${requestId}`);

  const updatedAttachments = [...attachments];

  for (let i = 0; i < updatedAttachments.length; i++) {
    const att = updatedAttachments[i];
    if (att.status !== "processing_extraction") continue;

    try {
      // 1. Determina o caminho de download
      let storagePath = att.storageRef;
      if (!storagePath && att.url) {
        // Tenta extrair o path caso o Storage URL seja direto
        const decodedUrl = decodeURIComponent(att.url);
        const match = decodedUrl.match(/\/o\/(.+)\?/);
        if (match && match[1]) {
          storagePath = match[1];
        }
      }

      if (!storagePath) {
        throw new Error("Nenhum storageRef ou URL válido encontrado para o download do arquivo.");
      }

      // 2. Baixa o arquivo do Storage
      logger.info(`📥 Baixando arquivo: ${att.name} (${storagePath})`);
      const fileBuffer = await downloadFileFromStorage(storagePath);

      // 3. Processa dependendo do tipo MIME
      let resultText: { summary: string; textExtracted: string; keyExcerpts: string[] } = { summary: "", textExtracted: "", keyExcerpts: [] };

      if (att.mimeType.startsWith("image/")) {
        logger.info(`🧠 Processando imagem multimodal (Gemini): ${att.name}`);
        resultText = await processImageArtifact(fileBuffer, att.mimeType, att.name);
      } else {
        // Fallback básico para não-imagens (PDFs/Text) - OCR simples / Leitura de string
        logger.info(`📄 Processando arquivo como texto/documento: ${att.name}`);
        const rawContent = fileBuffer.toString("utf-8");
        resultText = {
          summary: `Arquivo de texto contendo ${att.name}`,
          textExtracted: rawContent.slice(0, 10000), // Protege estouro de contexto incial
          keyExcerpts: [rawContent.slice(0, 120)]
        };
      }

      // 4. Atualiza os dados do artefato baseado na doutrina Text-First
      att.summary = resultText.summary || `Anexo: ${att.name}`;
      att.textExtracted = resultText.textExtracted || "";
      att.keyExcerpts = resultText.keyExcerpts || [];
      att.status = "ready";
      att.availableToLotus = true;
      att.includedInline = true;
      att.fullTextDeferred = false;

      logger.info(`✅ Extração concluída com sucesso para o anexo ${att.name}`);
    } catch (err: any) {
      logger.error(`❌ Falha ao extrair artefato ${att.name}:`, err.message);
      att.status = "failed";
      att.availableToLotus = false;
      att.summary = `Falha na extração de texto: ${err.message}`;
    }
  }

  // 5. Verifica se todos os anexos já foram processados
  const stillProcessing = updatedAttachments.some((a: any) => a.status === "processing_extraction");
  const nextStatus = stillProcessing ? "processing_extraction" : "queued_for_openclaw";

  await docRef.update({
    attachments: updatedAttachments,
    status: nextStatus,
    updatedAt: FieldValue.serverTimestamp()
  });

  logger.info(`🏁 Pipeline concluído para request ${requestId}. Novo status: ${nextStatus}`);
}

/**
 * Gatilhos de Firestore para o Request
 */
export const onPulsoRequestCreated = onDocumentCreated(
  { document: REQUESTS_PATH, region: "us-central1", secrets: ["GEMINI_API_KEY"] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    await runExtractionPipeline(event.params.requestId, snap.data());
  }
);

export const onPulsoRequestUpdated = onDocumentUpdated(
  { document: REQUESTS_PATH, region: "us-central1", secrets: ["GEMINI_API_KEY"] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    
    const beforeData = snap.before.data();
    const afterData = snap.after.data();

    // Evita loop infinito - só reage se o status ou attachments mudaram
    const beforeStatus = beforeData.status;
    const afterStatus = afterData.status;

    if (beforeStatus === afterStatus && JSON.stringify(beforeData.attachments) === JSON.stringify(afterData.attachments)) {
      return;
    }

    if (afterStatus === "processing_extraction") {
      await runExtractionPipeline(event.params.requestId, afterData);
    }
  }
);
