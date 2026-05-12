
import { PulsoRequest, Person, Source, Task, Decision, Alert, Project, Area, Agent } from '../../types/pulso.types';

export interface MaterializationResult {
  ok: boolean;
  action: "created" | "updated" | "skipped" | "needs_clarification" | "needs_approval" | "failed";
  entityType?: string;
  entityRef?: string;
  entityPath?: string;
  missingFields?: string[];
  summary: string;
}

export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
};

/**
 * MATERIALIZERS
 */

const materializePerson = (request: PulsoRequest): MaterializationResult => {
  const payload = request.payload;
  if (!payload?.name) return { ok: false, action: "needs_clarification", missingFields: ["name"], summary: "Nome da pessoa é obrigatório." };

  const slug = slugify(payload.name);
  const personId = `person_${slug}`;

  return {
    ok: true,
    action: "created",
    entityType: "person",
    entityRef: personId,
    entityPath: `workspaces/felipe_dutra/pulso_people/${personId}`,
    summary: `Pessoa '${payload.name}' materializada como ${personId}.`
  };
};

const materializeSource = (request: PulsoRequest): MaterializationResult => {
  const payload = request.payload;
  if (!payload?.name) return { ok: false, action: "needs_clarification", missingFields: ["name"], summary: "Nome da fonte é obrigatório." };

  const slug = slugify(payload.name);
  const sourceId = `source_${slug}`;

  return {
    ok: true,
    action: "created",
    entityType: "source",
    entityRef: sourceId,
    entityPath: `workspaces/felipe_dutra/pulso_sources/${sourceId}`,
    summary: `Fonte '${payload.name}' materializada como ${sourceId}.`
  };
};

const materializeTask = (request: PulsoRequest): MaterializationResult => {
  const payload = request.payload;
  if (!payload?.title && !request.title) return { ok: false, action: "needs_clarification", missingFields: ["title"], summary: "Título da tarefa é obrigatório." };

  const taskId = `task_${Date.now()}`;

  return {
    ok: true,
    action: "created",
    entityType: "task",
    entityRef: taskId,
    entityPath: `workspaces/felipe_dutra/pulso_tasks/${taskId}`,
    summary: `Tarefa '${payload?.title || request.title}' materializada.`
  };
};

const materializeAgent = (request: PulsoRequest): MaterializationResult => {
  // SEGURANÇA: Não cria agente ativo direto
  return {
    ok: true,
    action: "needs_approval",
    entityType: "agent_blueprint",
    summary: "Solicitação de novo agente requer aprovação humana explícita por segurança estrutural."
  };
};

/**
 * DISPATCHER
 */
export const materializeRequest = (request: PulsoRequest): MaterializationResult => {
  switch (request.requestType) {
    case 'register_person': return materializePerson(request);
    case 'register_source': return materializeSource(request);
    case 'create_task': return materializeTask(request);
    case 'create_agent': return materializeAgent(request);
    case 'register_decision': 
      return { ok: true, action: "created", entityType: "decision", summary: "Decisão materializada." };
    case 'create_alert':
      return { ok: true, action: "created", entityType: "alert", summary: "Alerta materializado." };
    case 'create_project':
      return { ok: true, action: "created", entityType: "project", summary: "Projeto materializado." };
    case 'create_area':
      return { ok: true, action: "created", entityType: "area", summary: "Área materializada." };
    default:
      return { ok: true, action: "skipped", summary: `Tipo de solicitação '${request.requestType}' não exige materialização estrutural.` };
  }
};
