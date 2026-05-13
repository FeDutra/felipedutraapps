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
  | 'archived';

export interface PulsoRequest {
  id: string;
  requestType: RequestType;
  title: string;
  summary: string;
  status: RequestStatus;
  priority: Priority;
  areaRef?: string | null;
  projectRef?: string | null;
  sourceRef?: string | null;
  personRef?: string | null;
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
  origin?: {
    channel: 'whatsapp' | 'web' | 'voice' | 'routine' | 'system';
    source: string;
    sessionKey?: string;
    messageRef?: string;
  };
  createdByType?: ActorType;
  createdById?: string;
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
