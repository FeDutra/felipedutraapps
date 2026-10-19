import { pulsoId, ExecutorProvider, validateProviderBinding } from "../domain/contracts.mjs";

export class FakeExecutorProvider extends ExecutorProvider {
  constructor(id = "fake-executor") {
    super(id);
    this.runs = new Map();
  }

  async capabilities() {
    return {
      providerId: this.id,
      observe: true,
      steer: true,
      cancel: true,
      collect: true
    };
  }

  async submit(input) {
    const externalRunId = pulsoId("external");
    this.runs.set(externalRunId, { input, cancelled: false, steering: [] });
    return validateProviderBinding({
      providerType: "executor",
      providerId: this.id,
      connectionId: "isolated-test",
      externalRunId,
      externalSessionId: null,
      boundAt: new Date().toISOString(),
      metadata: {}
    });
  }

  async *observe(binding) {
    const run = this.runs.get(binding.externalRunId);
    if (!run || run.cancelled) return;
    yield { type: "progress", phase: "planning", message: "Plano aceito pelo executor falso." };
    yield { type: "progress", phase: "execution", message: "Execução determinística concluída." };
  }

  async steer(binding, instruction) {
    const run = this.runs.get(binding.externalRunId);
    if (!run) throw new Error("provider_run_not_found");
    run.steering.push(instruction);
    return { accepted: true, instruction };
  }

  async cancel(binding, reason) {
    const run = this.runs.get(binding.externalRunId);
    if (!run) return { accepted: false, reason: "provider_run_not_found" };
    run.cancelled = true;
    return { accepted: true, reason };
  }

  async collect(binding) {
    const run = this.runs.get(binding.externalRunId);
    if (!run) throw new Error("provider_run_not_found");
    if (run.cancelled) throw new Error("provider_run_cancelled");
    return {
      text: "Trabalho profundo concluído pelo executor falso.",
      artifacts: [{
        kind: "document",
        title: "Resultado determinístico",
        mediaType: "text/markdown",
        content: "# Resultado\n\nA execução isolada foi concluída."
      }]
    };
  }

  async health() {
    return { status: "healthy", providerId: this.id };
  }
}
