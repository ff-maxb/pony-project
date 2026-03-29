// =============================================
// Database types
// =============================================

export type TeamRole = 'owner' | 'admin' | 'member';
export type WorkflowStatus = 'draft' | 'active' | 'paused';
export type TriggerType = 'manual' | 'webhook' | 'cron' | 'event';
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface Team {
  id: string;
  name: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  created_at: string;
}

export interface Workflow {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  trigger_type: TriggerType;
  trigger_config: TriggerConfig;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface WorkflowVersion {
  id: string;
  workflow_id: string;
  version_number: number;
  definition: WorkflowDefinition;
  created_by: string;
  created_at: string;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  workflow_version_id: string;
  status: ExecutionStatus;
  trigger_data: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  error: string | null;
}

export interface ExecutionStep {
  id: string;
  execution_id: string;
  node_id: string;
  step_name: string;
  status: StepStatus;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface NangoConnection {
  id: string;
  team_id: string;
  integration_id: string;
  nango_connection_id: string;
  created_at: string;
}

// =============================================
// Trigger config types
// =============================================

export type TriggerConfig =
  | ManualTriggerConfig
  | WebhookTriggerConfig
  | CronTriggerConfig
  | EventTriggerConfig;

export interface ManualTriggerConfig {
  type: 'manual';
}

export interface WebhookTriggerConfig {
  type: 'webhook';
}

export interface CronTriggerConfig {
  type: 'cron';
  cron_expression: string;
}

export interface EventTriggerConfig {
  type: 'event';
  event_name: string;
  event_source: string; // integration ID
}

// =============================================
// Workflow definition (Inngest Workflow Kit format)
// =============================================

import type { Workflow as InngestWorkflow } from "@inngest/workflow-kit";

// WorkflowDefinition is the Inngest Workflow type stored in workflow_versions.definition
export type WorkflowDefinition = InngestWorkflow;


// =============================================
// Available integrations registry
// =============================================

export interface IntegrationDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  actions: { kind: string; label: string; description: string }[];
}

export const AVAILABLE_INTEGRATIONS: IntegrationDefinition[] = [
  {
    id: 'slack',
    name: 'Slack',
    icon: '💬',
    description: 'Send messages to Slack channels and users',
    actions: [
      { kind: 'slack_send_message', label: 'Send Message', description: 'Send a message to a Slack channel' },
    ],
  },
  {
    id: 'gmail',
    name: 'Gmail',
    icon: '📧',
    description: 'Send emails via Gmail',
    actions: [
      { kind: 'gmail_send_email', label: 'Send Email', description: 'Send an email via Gmail' },
    ],
  },
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    icon: '📊',
    description: 'Read and write Google Sheets data',
    actions: [
      { kind: 'google_sheets_append_row', label: 'Append Row', description: 'Append a row to a Google Sheet' },
    ],
  },
  {
    id: 'linear',
    name: 'Linear',
    icon: '📋',
    description: 'Create and manage Linear issues',
    actions: [
      { kind: 'linear_create_issue', label: 'Create Issue', description: 'Create a new issue in Linear' },
      { kind: 'linear_update_issue', label: 'Update Issue', description: 'Update an existing Linear issue' },
    ],
  },
  {
    id: 'calendly',
    name: 'Calendly',
    icon: '📅',
    description: 'Create scheduling links and manage events',
    actions: [
      { kind: 'calendly_create_scheduling_link', label: 'Create Scheduling Link', description: 'Generate a one-off scheduling link' },
    ],
  },
];
