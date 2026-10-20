import {
  validateProviderBinding,
  assertExternalIdsConfined,
  invariant,
  pulsoId
} from "../domain/contracts.mjs";

export class ProviderHarness {
  /**
   * Exercises full standard lifecycle: submit -> observe -> steer -> collect.
   */
  static async verifyExecutorLifecycle(provider, sample = {}) {
    const caps = await provider.capabilities();
    invariant(caps && typeof caps === "object", "capabilities_must_be_object");
    invariant(caps.providerId === provider.id, "capabilities_provider_id_mismatch");

    const runId = sample.runId ?? pulsoId("run");
    const turnId = sample.turnId ?? pulsoId("turn");
    const sessionId = sample.sessionId ?? "session_test";

    const submitRequest = {
      runId,
      turnId,
      sessionId,
      capability: sample.capability ?? "harness.verify",
      input: sample.input ?? { modality: "text", text: "Harness test input" }
    };

    // 1. Submit
    const binding = await provider.submit(submitRequest);
    validateProviderBinding(binding);
    assertExternalIdsConfined({ providerBinding: binding });

    // 2. Observe
    const observedEvents = [];
    if (caps.observe) {
      for await (const event of provider.observe(binding)) {
        invariant(event.type === "progress", "event_type_must_be_progress");
        invariant(event.phase, "event_phase_required");
        observedEvents.push(event);
      }
    }

    // 3. Steer
    let steerReceipt = null;
    if (caps.steer) {
      steerReceipt = await provider.steer(binding, { action: "adjust_parameters", value: 1.0 });
      invariant(steerReceipt && steerReceipt.accepted === true, "steer_must_be_accepted");
    }

    // 4. Collect
    const result = await provider.collect(binding);
    invariant(result && typeof result.text === "string", "collect_result_text_required");
    invariant(Array.isArray(result.artifacts), "collect_result_artifacts_array_required");

    // 5. Health
    const health = await provider.health();
    invariant(health && typeof health.status === "string", "health_status_required");

    return {
      ok: true,
      providerId: provider.id,
      capabilities: caps,
      binding,
      observedEvents,
      steerReceipt,
      result,
      health
    };
  }

  /**
   * Exercises cancellation lifecycle: submit -> cancel -> observe terminates -> collect rejects.
   */
  static async verifyExecutorCancellation(provider, sample = {}) {
    const runId = sample.runId ?? pulsoId("run");
    const turnId = sample.turnId ?? pulsoId("turn");
    const sessionId = sample.sessionId ?? "session_test";

    const binding = await provider.submit({
      runId,
      turnId,
      sessionId,
      capability: "harness.cancellation",
      input: { text: "Cancel test" }
    });

    const receipt = await provider.cancel(binding, "harness_cancelled");
    invariant(receipt.accepted === true, "cancellation_must_be_accepted");

    // Observe should yield 0 events or terminate immediately
    const eventsAfterCancel = [];
    for await (const event of provider.observe(binding)) {
      eventsAfterCancel.push(event);
    }
    invariant(eventsAfterCancel.length === 0, "no_events_should_yield_after_cancellation");

    // Collect should throw
    let collectThrew = false;
    try {
      await provider.collect(binding);
    } catch {
      collectThrew = true;
    }
    invariant(collectThrew, "collect_must_throw_after_cancellation");

    return { ok: true, receipt, cancelled: true };
  }

  /**
   * Exercises ModelProvider lifecycle: capabilities -> complete -> health.
   */
  static async verifyModelLifecycle(provider, sample = {}) {
    const caps = await provider.capabilities();
    invariant(caps && typeof caps === "object", "capabilities_must_be_object");

    const turnId = sample.turnId ?? pulsoId("turn");
    const sessionId = sample.sessionId ?? "session_test";

    const request = {
      turnId,
      sessionId,
      identityId: sample.identityId ?? "lotus",
      input: sample.input ?? { modality: "text", text: "Model test input" }
    };

    const completion = await provider.complete(request);
    invariant(completion && typeof completion.text === "string", "completion_text_required");
    invariant(completion.providerId === provider.id, "completion_provider_id_mismatch");

    const health = await provider.health();
    invariant(health && typeof health.status === "string", "health_status_required");

    return {
      ok: true,
      providerId: provider.id,
      capabilities: caps,
      completion,
      health
    };
  }
}
