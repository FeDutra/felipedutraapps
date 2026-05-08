/**
 * @file pulso.types.ts
 * @description Core ontology and type definitions for the PULSO ecosystem.
 */

export type Status = 'active' | 'in_progress' | 'maintenance' | 'paused' | 'archived' | 'completed' | 'blocked' | 'broken' | 'incerto' | 'open' | 'acknowledged' | 'resolved' | 'ignored' | 'new' | 'triaged' | 'converted' | 'discarded' | 'pending' | 'running' | 'success' | 'failed';

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
  | 'context_update';

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
  areaRef?: string;
  projectRef?: string;
  confidence?: Confidence;
  uncertainties?: string[];
  createdAt: Date;
  updatedAt: Date;
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
}

export interface Task extends BaseEntity {
  ownerRefs: string[];
  dueAt?: Date;
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
  areaRef?: string;
  projectRef?: string;
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

export interface Tag {
  id: string;
  name: string;
  type: 'nature' | 'energy' | 'time' | 'cognitive' | 'risk';
  description?: string;
}
