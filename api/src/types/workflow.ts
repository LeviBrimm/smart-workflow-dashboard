export type WorkflowStatus = 'active' | 'inactive';
export type TriggerKind = 'schedule' | 'webhook';
export type ActionKind = 'send_email' | 'http_request' | 'write_s3';
export type RunStatus = 'queued' | 'running' | 'success' | 'failed' | 'canceled';
export type RunStepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface WorkflowStep {
  id: string;
  idx: number;
  actionKind: ActionKind;
  config: Record<string, unknown>;
}

export interface WorkflowTrigger {
  id: string;
  workflowId: string;
  kind: TriggerKind;
  config: Record<string, unknown>;
}

export interface WorkflowSummary {
  id: string;
  name: string;
  status: WorkflowStatus;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDetail extends WorkflowSummary {
  steps: WorkflowStep[];
  triggers: WorkflowTrigger[];
}

export interface RunRecord {
  id: string;
  workflowId: string;
  triggerId: string | null;
  triggerKind?: TriggerKind;
  status: RunStatus;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  inputPayload?: Record<string, unknown>;
  resultPayload?: Record<string, unknown>;
  error?: string;
}

export interface RunStepRecord {
  id: string;
  runId: string;
  stepIdx: number;
  status: RunStepStatus;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
}
