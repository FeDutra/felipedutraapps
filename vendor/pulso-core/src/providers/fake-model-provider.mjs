import { ModelProvider } from "../domain/contracts.mjs";

export class FakeModelProvider extends ModelProvider {
  constructor(id, label = id) {
    super(id, label);
  }

  async capabilities() {
    return {
      providerId: this.id,
      modalities: ["text"],
      streaming: false,
      local: true
    };
  }

  async complete(request) {
    return {
      providerId: this.id,
      text: "[" + this.label + "] " + request.input.text,
      usage: { inputUnits: request.input.text.length, outputUnits: request.input.text.length + this.label.length + 3 }
    };
  }

  async *stream(request) {
    const out = await this.complete(request);
    yield {
      type: "model.delta",
      kind: "delta",
      providerId: this.id,
      text: out.text,
      delta: out.text,
      index: 0
    };
    yield {
      type: "model.completed",
      kind: "completed",
      providerId: this.id,
      text: out.text,
      outputText: out.text,
      usage: out.usage
    };
  }

  async health() {
    return { status: "healthy", providerId: this.id };
  }
}
