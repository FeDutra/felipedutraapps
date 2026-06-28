/**
 * @file pulso.types.ts
 * @description Core ontology and type definitions for the PULSO ecosystem.
 */

export type Status = 'active' | 'in_progress' | 'maintenance' | 'paused' | 'archived' | 'completed' | 'blocked' | 'broken' | 'incerto' | 'open' | 'acknowledged' | 'resolved' | 'ignored' | 'new' | 'triaged' | 'converted' | 'discarded' | 'pending' | 'running' | 'success' | 'failed' | 'received' | 'validated' | 'rejected' | 'converted_to_inbox' | 'processing' | 'processed';

export type Priority = 'critical' | 'high' | 'medium' | 'low' | 'incerto';

export type Stage = 'seed' | 'front' | 'project' | 'operation' | 'maintenance' | 'closed';

export type Confidence = 'high' | 'medium' | 'low';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type SourceType = 
  | 'google_sheet' 
  | 'google_doc' 
  | 'google_drive_folder' 
  | 'google_drive_file' 
  | 'gmail' 
  | 'google_calendar' 
  | 'trello_board' 
  | 'notion_database' 
  | 'notion_page' 
  | 'obsidian_vault' 
  | 'obsidian_note' 
  | 'whatsapp_chat' 
  | 'telegram_chat' 
  | 'vps_service' 
  | 'local_app' 
  | 'paperclip_service' 
  | 'firebase_project' 
  | 'webhook' 
  | 'manual_input';

export type InboxType = 
  | 'task' 
  | 'idea' 
  | 'decision' 
  | 'meeting' 
  | 'file' 
  | 'metric' 
  | 'alert' 
  | 'log' 
  | 'laterality' 
  | 'insight' 
  | 'potential_project' 
  | 'summary' 
  | 'pending_request'
  | 'ingestion'
  | 'system_update'
  | 'context_update'
  | 'agent_update'
  | 'health_signal';

export type EventType = 
  | 'inbox_item_created'
  | 'inbox_item_updated'
  | 'inbox_item_triaged'
  | 'inbox_item_converted'
  | 'task_created'
  | 'decision_created'
  | 'note_created'
  | 'meeting_created'
  | 'project_created'
  | 'project_updated'
  | 'alert_acknowledged'
  | 'alert_resolved'
  | 'routine_paused'
  | 'routine_reactivated'
  | 'agent_updated'
  | 'source_updated'
  | 'ingestion_received'
  | 'ingestion_validated'
  | 'ingestion_rejected'
  | 'ingestion_failed'
  | 'ingestion_duplicate'
  | 'health_signal_received'
  | 'sync_signal_received'
  | 'operational_request_created';

export type RequestType = 
  | 'create_agent'
  | 'create_area'
  | 'create_project'
  | 'register_source'
  | 'register_person'
  | 'refresh_state'
  | 'sync_area'
  | 'create_task'
  | 'register_decision'
  | 'create_alert'
  | 'update_person'
  | 'archive_person'
  | 'link_person_to_project'
  | 'unlink_person_from_project'
  | 'link_person_to_area'
  | 'unlink_person_from_area'
  | 'update_project'
  | 'archive_project'
  | 'change_project_status'
  | 'change_project_priority'
  | 'link_project_to_area'
  | 'update_task'
  | 'complete_task'
  | 'archive_task'
  | 'link_task_to_project'
  | 'link_task_to_area'
  | 'update_source'
  | 'archive_source'
  | 'link_source_to_project'
  | 'unlink_source_from_project'
  | 'link_source_to_area'
  | 'unlink_source_from_area';

export type RequestStatus = 
  | 'requested'
  | 'accepted'
  | 'running'
  | 'needs_clarification'
  | 'needs_approval'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'archived'
  // v1.4+: Lótus Live → OpenClaw lifecycle
  | 'queued_for_openclaw'
  | 'picked_by_openclaw'
  | 'processing_by_openclaw'
  | 'proposal_ready'
  | 'waiting_user_approval'
  // v1.6: failure state
  | 'openclaw_failed'
  // v1.7: human approval decisions
  | 'approved_by_user'
  | 'rejected_by_user'
  // v1.8: execution tracking
  | 'executed'
  | 'execution_failed'
  | 'execution_blocked';


/**
 * @interface OpenClawResult
 * @description Structured response written back by OpenClaw after processing a conversation_command handoff.
 * Stored in pulso_requests[id].openclawResult. Never triggers automatic execution.
 * v1.4 — Read-only response layer.
 * v1.6 — Expanded with summary, proposedActions, riskLevel, requiresHumanApproval, errors, confidence.
 */
export interface OpenClawResult {
  /** Who processed this — 'openclaw' or any future agent id */
  processedBy: string;
  processedAt: string | Date;
  createdAt?: string | Date;
  /** Natural-language response to surface in the Lótus Live chat bubble */
  responseText: string;
  /** Short one-line summary (optional, for Registro da Lótus feed) */
  summary?: string;
  /** Top-level confidence of the response */
  confidence?: 'high' | 'medium' | 'low';
  /** Risk level of the proposed action, if any */
  riskLevel?: 'low' | 'medium' | 'high';
  /** Whether this result requires explicit human approval before any action */
  requiresHumanApproval?: boolean;
  /** Ordered action plan, if applicable */
  actionPlan?: {
    steps: string[];
    estimatedRisk: 'low' | 'medium' | 'high';
    requiresConfirmation: boolean;
  };
  /**
   * v1.6: Flat list of proposed actions — human readable, never auto-executed.
   * Replaces/supplements actionPlan for simpler cases.
   */
  proposedActions?: Array<{
    label: string;
    description?: string;
    riskLevel?: 'low' | 'medium' | 'high';
    requiresConfirmation?: boolean;
  }>;
  /** Firestore collections or external sources that were consulted */
  sourcesConsulted?: string[];
  /**
   * Proposed mutation payload — only present for create_proposal / update_proposal / external_message_proposal.
   * OpenClaw MUST NOT execute this automatically. It is a preview for human approval.
   */
  proposedMutation?: {
    type: string;
    payload: Record<string, any>;
    previewLabel: string;
  };
  /** Status the OpenClaw recommends transitioning to */
  statusTransition?: RequestStatus;
  /** v1.6: Error list if processing partially failed */
  errors?: string[];
  auditLog?: {
    model?: string;
    skillUsed?: string;
    confidence?: 'high' | 'medium' | 'low';
    notes?: string;
  };
}

/**
 * @interface UserApproval
 * @description Human approval or rejection decision recorded after OpenClaw returns a proposal.
 * Stored in pulso_requests[id].userApproval.
 * v1.7 — Governance layer. Recording ONLY — never triggers automatic execution.
 */
export interface UserApproval {
  /** Whether the user approved (true) or rejected (false) the proposal */
  approved: boolean;
  approvedBy?: string;
  rejectedBy?: string;
  /** ISO timestamp of approval */
  approvedAt?: string;
  /** ISO timestamp of rejection */
  rejectedAt?: string;
  /** Optional free-text note from the approver */
  note?: string;
  /** Optional reason for rejection */
  reason?: string;
}

export interface PulsoContextNode {
  areaId: string;
  subareaId: string;
  contextId: string;
  chatId: string;
  openclawSessionKey: string;
  label: string;
  archived?: boolean;
  isDefault?: boolean;
  lastMessageAt?: Date;
  updatedAt?: Date;
}

/**
 * @interface Session
 * @description A persistent session entity in the Pulso ecosystem.
 * Sessions are the primary unit of context separation — each session has
 * its own conversation history, identity, and OpenClaw session key.
 *
 * areaId is optional: a session can be linked to an area (e.g. "work/modu")
 * or be free/transversal (e.g. "general planning").
 */
export interface Session {
  /** Unique identifier — used as the contextId in chat and requests */
  id: string;
  /** Human-readable display name */
  label: string;
  /** Optional area this session belongs to */
  areaId?: string | null;
  /** Optional subarea identifier for legacy compatibility */
  subareaId?: string;
  /** The OpenClaw session key used to route to the correct agent context */
  openclawSessionKey: string;
  /** Whether this is a seeded/system session that ships with the platform */
  isDefault?: boolean;
  /** ISO timestamp of last message activity */
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  archived?: boolean;
  archivedAt?: Date;
}

export interface PulsoRequest {
  id: string;
  requestType: RequestType | 'conversation_command' | string;
  title: string;
  summary: string;
  status: RequestStatus;
  priority: Priority;
  areaId?: string;
  contextId?: string;
  chatId?: string;
  openclawSessionKey?: string;
  areaRef?: string | null;
  projectRef?: string | null;
  sourceRef?: string | null;
  personRef?: string | null;
  secondaryAreaRefs?: string[];
  routing?: {
    rawInput?: string;
    cleanInput?: string;
    sessionTarget?: string;
    secondaryTopics?: string[];
    intentType?: string;
    shouldSendToLotus?: boolean;
    shouldCreateSideNotes?: boolean;
    contextHints?: string[];
    routerVersion?: string;
    confidence?: number;
  };
  requestedBy: string;
  requestedAt: Date;
  updatedAt: Date;
  payload?: any;
  result?: any;
  error?: string;
  recoverable?: boolean;
  nextSuggestedAction?: string;
  processedBy?: string;
  processedAt?: Date;
  archived?: boolean;
  dedupeKey?: string;
  sourceHash?: string;
  /**
   * v1.3+: Origin of the request — may be a string (e.g. 'lotus_live') or a structured object.
   * Typed as flexible to support both the Lótus Live origin strings and classic channel objects.
   */
  origin?: string | {
    channel: 'whatsapp' | 'web' | 'voice' | 'routine' | 'system';
    source: string;
    sessionKey?: string;
    messageRef?: string;
  };
  /** v1.3+: Source identifier string — e.g. 'pulso_live' */
  source?: string;
  createdByType?: ActorType;
  createdById?: string;
  /**
   * v1.3+: OpenClaw handoff contract. Generated by liveIntentInterpreter.
   * proposal_only mode — never auto-executed.
   */
  handoff?: {
    target: string;
    mode: string;
    canExecuteNow: boolean;
    requiresHumanConfirmation: boolean;
    intent: string;
    domain: string;
    riskLevel: 'low' | 'medium' | 'high';
    actionType: string;
    entitiesMentioned: string[];
    suggestedNextStep: string;
    executionPrompt: string;
  };
  /**
   * v1.3+: Local interpretation metadata from liveIntentInterpreter.
   */
  interpretation?: any;
  /**
   * v1.4+: OpenClaw response written back after processing a conversation_command handoff.
   * Optional — only present after OpenClaw has consumed and responded to the handoff.
   * Read by LivePage to display the result in the chat bubble.
   */
  openclawResult?: OpenClawResult;
  /**
   * v1.7: Human approval/rejection decision.
   * Recorded after OpenClaw returns a proposal with requiresHumanApproval = true.
   * NEVER triggers automatic execution of the proposal.
   */
  userApproval?: UserApproval;
  /** v1.8: Execution tracking */
  executedAt?: string | Date;
  executedBy?: string;
  createdEntityRef?: string;
  executionError?: string;
}

export type ActorType = 'user' | 'agent' | 'system';

export type EventOrigin = 'manual' | 'openclaw' | 'firestore' | 'system' | 'seed';

export type IngestionStatus = 
  | 'received' 
  | 'validated' 
  | 'rejected' 
  | 'converted_to_inbox' 
  | 'converted_to_entity'
  | 'duplicate'
  | 'ignored'
  | 'failed';

export type OutboxStatus = 'pending' | 'processing' | 'processed' | 'ignored' | 'failed';

export type LateralityState = 'captured' | 'recurring' | 'clustered' | 'validated_signal' | 'promoted';

export interface BaseEntity {
  id: string;
  slug: string;
  name: string;
  description?: string;
  status: Status;
  priority: Priority;
  tags?: string[];
  notes?: string;
  sourceRefs?: string[];
  peopleRefs?: string[];
  areaRef?: string | null;
  projectRef?: string | null;
  confidence?: Confidence;
  uncertainties?: string[];
  createdAt: Date;
  updatedAt: Date;
  archived?: boolean;
  archivedAt?: Date;
  archivedBy?: string;
  archiveReason?: string;
  cleanupBatch?: string;
}

export interface Area extends BaseEntity {
  type: 'business' | 'personal' | 'family' | 'school' | 'infrastructure' | 'creative' | 'financial' | 'health' | 'land' | 'hybrid';
  importance: Priority;
  riskSummary?: string;
  nextReviewAt?: Date;
  aliases?: string[];
  keywords?: string[];
  contextHints?: string[];
  defaultAgentId?: string;
  notionAreaUrl?: string;
  visibility?: 'private' | 'shared';
}

export interface Project extends BaseEntity {
  stage: Stage;
  objective?: string;
  nextStep?: string;
  lastKnownAction?: string;
  secondaryAreaRefs?: string[];
  riskSummary?: string;
}

export interface Source extends BaseEntity {
  type: SourceType;
  system: string;
  url?: string;
  externalId?: string;
  syncMode: 'manual' | 'semi_auto' | 'auto' | 'incerto';
  lastSyncAt?: Date;
}

export interface Person extends BaseEntity {
  role?: string;
  organization?: string;
  relationshipToFe?: string;
  importance: Priority;
  contactMethods?: string[];
}

export interface InboxItem extends BaseEntity {
  type: InboxType;
  body: string;
  originChannel?: string;
  suggestedDestination?: string;
  lateralityState?: LateralityState;
  processedAt?: Date;
  attachments?: string[];
  convertedToRef?: string;
  convertedToType?: string;
  originLabel?: string;
  originAgentRef?: string;
}

export interface Task extends BaseEntity {
  title?: string;
  ownerRefs: string[];
  dueAt?: Date;
  dueDate?: Date;
  weekTarget?: boolean;
  dependsOnTaskRefs?: string[];
  dependsOnPeopleRefs?: string[];
  originInboxRef?: string;
  impactRefs?: string[];
  deliverable?: string;
  completedAt?: Date;
}

export interface Decision extends BaseEntity {
  decision: string;
  context?: string;
  reasoning?: string;
  takenByRefs: string[];
  impactSummary?: string;
  reviewAt?: Date;
}

export interface Meeting extends BaseEntity {
  date: Date;
  participantsRefs: string[];
  summary?: string;
  decisionRefs?: string[];
  taskRefs?: string[];
  recordingLinks?: string[];
}

export interface Note extends BaseEntity {
  type: 'summary' | 'insight' | 'analysis' | 'context' | 'handoff' | 'reflection' | 'pattern' | 'synthesis';
  body: string;
}

export interface Routine extends BaseEntity {
  frequency: string;
  triggerType: 'cron' | 'manual' | 'event' | 'hybrid';
  tool: string;
  agentRefs?: string[];
  lastRunAt?: Date;
  nextRunAt?: Date;
  riskSummary?: string;
  outputExpected?: string;
}

export interface RoutineRun {
  id: string;
  routineRef: string;
  startedAt: Date;
  finishedAt?: Date;
  status: 'success' | 'failure' | 'running';
  outputSummary?: string;
  errorSummary?: string;
  logRefs?: string[];
}

export interface Agent extends BaseEntity {
  role: string;
  inputTypes?: string[];
  outputTypes?: string[];
  systemsUsed?: string[];
  frequency?: string;
  limitations?: string[];
  suggestedImprovements?: string[];
  lastActivityAt?: Date;
}

export interface Metric extends BaseEntity {
  metricType: string;
  value: string | number;
  unit: string;
  target?: string | number;
  measuredAt: Date;
}

export interface Alert extends BaseEntity {
  severity: Severity;
  agentRef?: string;
  routineRef?: string;
  resolvedAt?: Date;
  ownerRefs?: string[];
}

export interface Log {
  id: string;
  type: string;
  system: string;
  severity: Severity;
  event: string;
  payloadSummary?: string;
  areaRef?: string | null;
  projectRef?: string | null;
  routineRef?: string;
  agentRef?: string;
  sourceRef?: string;
  syncJobRef?: string;
  createdAt: Date;
}

export interface SyncJob extends BaseEntity {
  originSystem: string;
  targetSystem: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'paused';
  lastRunAt?: Date;
  nextRunAt?: Date;
  errorMessage?: string;
  recordsProcessed?: number;
}

export interface IngestionEvent extends BaseEntity {
  event_id?: string;
  source_run_id?: string;
  dedupe_key?: string;
  type: InboxType;
  rawInput: any;
  summary?: string;
  areaRef?: string | null;
  projectRef?: string | null;
  sourceRefs?: string[];
  peopleRefs?: string[];
  originLabel?: string;
  originAgentRef?: string;
  confidence?: Confidence;
  tags?: string[];
  ingestionStatus: IngestionStatus;
  target_entity_type?: string;
  target_entity_ref?: string;
  should_create_inbox_item?: boolean;
  requires_human_review?: boolean;
  payload?: {
    raw_input?: string;
    context?: string;
    suggested_action?: string;
    severity?: Severity;
    status?: Status;
    external_refs?: any;
    metadata?: any;
  };
  errorMessage?: string;
}

export interface PulsoEvent {
  id: string;
  eventType: EventType;
  entityType: InboxType | string;
  entityRef: string;
  areaRef?: string | null;
  projectRef?: string | null;
  sourceRefs?: string[];
  actorType: ActorType;
  actorRef?: string;
  origin: EventOrigin;
  payloadSummary?: string;
  payloadSnapshot?: any;
  createdAt: Date;
  processedByAgents?: string[];
  outboxStatus: OutboxStatus;
  archived?: boolean;
  archivedAt?: Date;
  archivedBy?: string;
  archiveReason?: string;
  cleanupBatch?: string;
}

export interface Tag {
  id: string;
  name: string;
  type: 'nature' | 'energy' | 'time' | 'cognitive' | 'risk';
  description?: string;
}
