import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { emitPulsoLedgerEvents, PulsoLedgerEvent } from "./lib/pulsoLedgerEmitter";

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
    // DESATIVADO: O OpenClaw real (bot Python/Telegram) agora processa as requisições.
    // Este mock no Cloud Functions não deve mais interferir ou roubar a fila.
    logger.info("⚡ processOpenClawQueue DESATIVADO para dar lugar ao OpenClaw real.");
    return;

    const db = getFirestore();
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
          startedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        logger.info(`🛠️ Claimed request ${requestId}`);

        // 3️⃣ OpenClaw adapter (using Groq for Deep Reasoning)
        let simulatedText = "Não foi possível gerar um plano de ação estruturado.";
        let detectedEvents: Partial<PulsoLedgerEvent>[] = [];

        if (data.input) {
          const inputLower = data.input.toLowerCase();
          
          if (inputLower.includes("ping real no ledger")) {
            detectedEvents.push({
              source: "lotus_openclaw",
              intent: "Registrar teste real da Lótus no Ledger da PULSO",
              action: "system.ledger_ping",
              target: "pulso/live",
              payload: { message: "Lótus enviou um evento para a PULSO durante uma conversa real." },
              status: "success",
              result: { ok: true },
              externalRefs: {},
              surface: "openclaw"
            });
            simulatedText = "Pronto! Registrei o ping no Ledger da PULSO com sucesso.";
          } 
          else if (inputLower.includes("tarefa de teste no ledger")) {
            detectedEvents.push({
              source: "lotus_openclaw",
              intent: "Registrar intenção de tarefa criada pela Lótus",
              action: "notion.create_task",
              target: "notion/test",
              payload: {
                title: "Teste real de tarefa via Lótus/OpenClaw",
                assignee: "Fê",
                project: "PULSO"
              },
              status: "success",
              result: { taskId: "openclaw_test_task_001" },
              externalRefs: { notionPageId: "openclaw_test_task_001" },
              surface: "openclaw"
            });
            simulatedText = "Maravilha! Já enviei o evento de criação da tarefa para o Ledger.";
          }
          else if (data.input.includes("PULSO_DIRECT_TEST_001")) {
            simulatedText = "DIRECT_OK_001";
          } else {
            // Real LLM Processing
            try {
              const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
                },
                body: JSON.stringify({
                  model: "llama-3.3-70b-versatile",
                  messages: [
                    { role: "user", content: data.input }
                  ],
                  temperature: 0.1
                })
              });
              
              if (response.ok) {
                const result: any = await response.json();
                if (result.choices && result.choices.length > 0) {
                  simulatedText = result.choices[0].message.content;
                }
              } else {
                const errorText = await response.text();
                logger.error(`[OpenClaw] Groq API Error: ${errorText}`);
                simulatedText = `Falha analítica profunda. A conexão com o núcleo cognitivo retornou anomalia. (Error: ${response.status})`;
              }
            } catch (apiErr: any) {
              logger.error(`[OpenClaw] Groq Fetch Error:`, apiErr);
              simulatedText = `Interrupção crítica no Raciocínio Profundo.`;
            }
          }
        }

        if (detectedEvents.length > 0) {
          logger.info(`[OpenClaw] Detectados ${detectedEvents.length} pulsoEvents. Chamando emissor...`);
          await emitPulsoLedgerEvents(detectedEvents, db);
        }

        const simulatedResult = {
          status: "success",
          intent: "unknown",
          responseText: simulatedText,
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
          updatedAt: FieldValue.serverTimestamp(),
          processedAt: FieldValue.serverTimestamp(),
        });
        logger.info(`✅ Processed request ${requestId} → proposal_ready`);
      } catch (err: any) {
        // 5️⃣ On failure, mark as failed with error details
        await docRef.update({
          status: "failed",
          error: err.message ?? "unknown",
          updatedAt: FieldValue.serverTimestamp(),
        });
        logger.error(`❌ Failed processing request ${requestId}:`, err);
      }
    }
  }
);
