import { assertExternalIdsConfined } from "../domain/contracts.mjs";

/**
 * Generates both a structured JSON report and a formatted human-readable Markdown report
 * for shadow execution runs, asserting sovereign identity, session, memory, policy preservation
 * and external ID confinement.
 */
export function generateShadowReport({
  run,
  turn,
  session,
  adapter,
  rawFrames = [],
  normalizedEvents = [],
  anomalies = [],
  expectedMemory
}) {
  const binding = run?.providerBinding ?? null;
  const externalRunId = binding?.externalRunId;
  const trace = externalRunId && adapter?.getRunTrace ? adapter.getRunTrace(externalRunId) : null;

  const actualRawFrames = trace?.rawFrames ?? rawFrames;
  const actualNormalized = trace?.normalizedEvents ?? normalizedEvents;
  const actualAnomalies = trace?.anomalies ?? anomalies;

  // 1. Sovereign Identity Preservation check
  const identityId = turn?.identityId ?? session?.identityId ?? "lotus";
  const identityPreserved = identityId === "lotus";

  // 2. Session Preservation check
  const sessionId = turn?.sessionId ?? session?.sessionId ?? null;
  const sessionPreserved = Boolean(sessionId && (session ? turn?.sessionId === session.sessionId : true));

  // 3. Semantic Memory Preservation check
  const memory = turn?.memory ?? turn?.payload?.memory ?? null;
  let memoryPreserved = false;
  if (expectedMemory !== undefined) {
    memoryPreserved = expectedMemory !== null && JSON.stringify(memory) === JSON.stringify(expectedMemory);
  } else {
    // Semantic check: must be a non-null, valid object with preserved keys
    memoryPreserved = Boolean(memory && typeof memory === "object" && Object.keys(memory).length > 0);
  }

  // 4. Policy Preservation check
  const policy = turn?.policy ?? turn?.payload?.policy ?? null;
  const policyPreserved = policy?.localOnly !== false;

  // 5. External ID Confinement check
  let externalIdsConfined = false;
  let leakageError = null;
  try {
    assertExternalIdsConfined({ run: { ...run, providerBinding: undefined }, turn, session });
    externalIdsConfined = true;
  } catch (err) {
    externalIdsConfined = false;
    leakageError = err.message;
  }

  // Count metrics
  let duplicatesCount = 0;
  let malformationsCount = 0;
  for (const anomaly of actualAnomalies) {
    if (anomaly.type === "duplicate") duplicatesCount++;
    if (anomaly.type === "malformation") malformationsCount++;
  }

  const allPassed = identityPreserved && sessionPreserved && memoryPreserved && policyPreserved && externalIdsConfined;

  const jsonReport = {
    reportVersion: "0.2.0",
    generatedAt: new Date().toISOString(),
    status: allPassed ? "CONFORMANT" : "NON_CONFORMANT",
    runId: run?.runId ?? null,
    turnId: turn?.turnId ?? null,
    sessionId,
    sovereignty: {
      identityId,
      identityPreserved,
      sessionPreserved,
      memoryPreserved,
      policyPreserved,
      externalIdsConfined,
      leakageError
    },
    providerBinding: binding,
    telemetry: {
      rawFramesReceived: actualRawFrames.length,
      normalizedEventsCount: actualNormalized.length,
      duplicatesDeduplicated: duplicatesCount,
      malformationsIsolated: malformationsCount,
      anomaliesTotal: actualAnomalies.length
    },
    anomalies: actualAnomalies
  };

  const humanReport = [
    `# Relatório de Conformidade e Auditoria Sombra v0.2`,
    ``,
    `**Data de geração:** ${jsonReport.generatedAt}`,
    `**Status Geral:** ${allPassed ? "✅ CONFORME (Aprovado)" : "❌ NÃO CONFORME (Falha Detectada)"}`,
    ``,
    `## 1. Verificação de Soberania e Preservação`,
    `- **Identidade Soberana:** ${identityPreserved ? `✅ Preservada ('${identityId}')` : `❌ Comprometida`}`,
    `- **Preservação de Sessão:** ${sessionPreserved ? `✅ Preservada ('${sessionId}')` : `❌ Divergência detectada`}`,
    `- **Preservação de Memória:** ${memoryPreserved ? `✅ Contexto semântico íntegro e preservado` : `❌ Falha na preservação de memória (ausente, vazia ou divergente)`}`,
    `- **Preservação de Políticas:** ${policyPreserved ? `✅ Diretrizes locais e soberanas mantidas` : `❌ Violação de política`}`,
    `- **Confinamento de IDs Externos:** ${externalIdsConfined ? `✅ APROVADO — zero vazamento fora de providerBinding` : `❌ VAZAMENTO: ${leakageError}`}`,
    ``,
    `## 2. Métricas de Execução Sombra e Telemetria`,
    `| Métrica | Valor |`,
    `| :--- | :--- |`,
    `| Frames brutos recebidos | ${actualRawFrames.length} |`,
    `| Eventos normalizados determinísticos | ${actualNormalized.length} |`,
    `| Frames duplicados descartados | ${duplicatesCount} |`,
    `| Malformações isoladas com resiliência | ${malformationsCount} |`,
    `| Total de anomalias registradas | ${actualAnomalies.length} |`,
    ``,
    `## 3. Confinamento em ProviderBinding`,
    `- **Provider ID:** ${binding?.providerId ?? "N/A"}`,
    `- **External Run ID:** \`${binding?.externalRunId ?? "null"}\``,
    `- **External Session ID:** \`${binding?.externalSessionId ?? "null"}\``,
    `- **Connection ID:** \`${binding?.connectionId ?? "null"}\``,
    ``,
    `## 4. Parecer Arquitetural`,
    allPassed
      ? `A execução em modo sombra operou dentro de todos os parâmetros estipulados para o marco v0.2 do PULSO Core. O motor externo permaneceu como executor substituível sem corromper nenhuma entidade de domínio.`
      : `Houve inconformidade detectada durante a execução sombra. Verifique os logs e anomalias detalhadas no relatório JSON correspondente.`
  ].join("\n");

  return {
    json: jsonReport,
    human: humanReport
  };
}
