export const OPENCLAW_FIXTURES = Object.freeze({
  happyPath: [
    {
      seq: 1,
      type: "claw.step",
      stage: "planning",
      message: "Analisando workspace e decompondo a tarefa.",
      percent: 15,
      timestamp: "2026-10-18T17:15:00.000Z",
      clawRunId: "claw_run_happy_01",
      agentId: "openclaw-agent-alpha"
    },
    {
      seq: 2,
      type: "claw.step",
      stage: "execution",
      message: "Executando inspeção dos arquivos locais e fixtures.",
      percent: 45,
      timestamp: "2026-10-18T17:15:01.000Z",
      clawRunId: "claw_run_happy_01",
      agentId: "openclaw-agent-alpha"
    },
    {
      seq: 3,
      type: "claw.step",
      stage: "validation",
      message: "Verificando conformidade com as diretrizes soberanas.",
      percent: 85,
      timestamp: "2026-10-18T17:15:02.000Z",
      clawRunId: "claw_run_happy_01",
      agentId: "openclaw-agent-alpha"
    },
    {
      seq: 4,
      type: "claw.step",
      stage: "completion",
      message: "Execução concluída com sucesso.",
      percent: 100,
      timestamp: "2026-10-18T17:15:03.000Z",
      clawRunId: "claw_run_happy_01",
      agentId: "openclaw-agent-alpha"
    }
  ],

  outOfOrder: [
    {
      seq: 3,
      type: "claw.step",
      stage: "validation",
      message: "Verificando conformidade de forma assíncrona.",
      percent: 85,
      timestamp: "2026-10-18T17:15:02.000Z",
      clawRunId: "claw_run_ooo_01"
    },
    {
      seq: 1,
      type: "claw.step",
      stage: "planning",
      message: "Iniciando plano de execução.",
      percent: 15,
      timestamp: "2026-10-18T17:15:00.000Z",
      clawRunId: "claw_run_ooo_01"
    },
    {
      seq: 4,
      type: "claw.step",
      stage: "completion",
      message: "Finalização do trabalho.",
      percent: 100,
      timestamp: "2026-10-18T17:15:03.000Z",
      clawRunId: "claw_run_ooo_01"
    },
    {
      seq: 2,
      type: "claw.step",
      stage: "execution",
      message: "Executando trabalho no sandbox.",
      percent: 50,
      timestamp: "2026-10-18T17:15:01.000Z",
      clawRunId: "claw_run_ooo_01"
    }
  ],

  duplicates: [
    {
      seq: 1,
      type: "claw.step",
      stage: "planning",
      message: "Iniciando plano.",
      percent: 20,
      timestamp: "2026-10-18T17:15:00.000Z",
      clawRunId: "claw_run_dup_01"
    },
    {
      seq: 1, // Duplicate sequence and payload
      type: "claw.step",
      stage: "planning",
      message: "Iniciando plano.",
      percent: 20,
      timestamp: "2026-10-18T17:15:00.000Z",
      clawRunId: "claw_run_dup_01"
    },
    {
      seq: 2,
      type: "claw.step",
      stage: "execution",
      message: "Executando tarefa.",
      percent: 60,
      timestamp: "2026-10-18T17:15:01.000Z",
      clawRunId: "claw_run_dup_01"
    },
    {
      seq: 2, // Duplicate sequence
      type: "claw.step",
      stage: "execution",
      message: "Executando tarefa.",
      percent: 60,
      timestamp: "2026-10-18T17:15:01.000Z",
      clawRunId: "claw_run_dup_01"
    },
    {
      seq: 3,
      type: "claw.step",
      stage: "completion",
      message: "Concluído.",
      percent: 100,
      timestamp: "2026-10-18T17:15:02.000Z",
      clawRunId: "claw_run_dup_01"
    }
  ],

  malformed: [
    {
      seq: 1,
      type: "claw.step",
      stage: "planning",
      message: "Plano válido.",
      percent: 25,
      timestamp: "2026-10-18T17:15:00.000Z"
    },
    {
      corruptedField: true // Missing recognizable event payload or type
    },
    {
      seq: 2,
      type: "claw.step",
      stage: "completion",
      message: "Conclusão válida.",
      percent: 100,
      timestamp: "2026-10-18T17:15:02.000Z"
    }
  ],

  terminalFailure: [
    {
      seq: 1,
      type: "claw.step",
      stage: "planning",
      message: "Plano inicial.",
      percent: 20,
      timestamp: "2026-10-18T17:15:00.000Z",
      clawRunId: "claw_run_fail_01"
    },
    {
      seq: 2,
      type: "claw.step",
      stage: "failed",
      error: { code: "terminal_sandbox_error", message: "Sandbox terminal process crash" },
      timestamp: "2026-10-18T17:15:01.000Z",
      clawRunId: "claw_run_fail_01"
    }
  ]
});
