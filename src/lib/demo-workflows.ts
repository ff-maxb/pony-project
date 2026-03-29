import type { WorkflowDefinition } from "@/types/workflow";

export interface DemoWorkflow {
  name: string;
  description: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  definition: WorkflowDefinition;
}

export const DEMO_WORKFLOWS: DemoWorkflow[] = [
  // ─── 1. New User Welcome Email ───────────────────────────────────────────
  {
    name: "New User Welcome Email",
    description: "Sends a personalised welcome email when a new user signs up via webhook.",
    trigger_type: "webhook",
    trigger_config: { type: "webhook" },
    definition: {
      actions: [
        {
          id: "1",
          kind: "gmail_send_email",
          name: "Send Welcome Email",
          inputs: {
            to: "!ref($.event.data.email)",
            subject: "Welcome to the platform!",
            body: "Hi,\n\nWelcome aboard! We're excited to have you.\n\nBest,\nThe Team",
          },
        },
        {
          id: "2",
          kind: "slack_send_message",
          name: "Notify Team on Slack",
          inputs: {
            channel: "#signups",
            message: "🎉 New user just signed up!",
          },
        },
      ],
      edges: [
        { from: "$source", to: "1" },
        { from: "1", to: "2" },
      ],
    },
  },

  // ─── 2. Daily Standup Reminder ───────────────────────────────────────────
  {
    name: "Daily Standup Reminder",
    description: "Posts a standup prompt to Slack every weekday morning at 9 AM.",
    trigger_type: "cron",
    trigger_config: { type: "cron", cron_expression: "0 9 * * 1-5" },
    definition: {
      actions: [
        {
          id: "1",
          kind: "slack_send_message",
          name: "Post Standup Prompt",
          inputs: {
            channel: "#general",
            message:
              "👋 *Daily Standup Time!*\n\nPlease share:\n1. What did you do yesterday?\n2. What are you doing today?\n3. Any blockers?",
          },
        },
      ],
      edges: [{ from: "$source", to: "1" }],
    },
  },

  // ─── 3. High-Value Lead Alert ─────────────────────────────────────────────
  {
    name: "High-Value Lead Alert",
    description: "When a lead is created, logs it to Google Sheets and alerts the sales team on Slack.",
    trigger_type: "webhook",
    trigger_config: { type: "webhook" },
    definition: {
      actions: [
        {
          id: "1",
          kind: "google_sheets_append_row",
          name: "Log to Google Sheets",
          inputs: {
            spreadsheet_id: "YOUR_SPREADSHEET_ID",
            sheet_name: "Leads",
            values: "!ref($.event.data.name), !ref($.event.data.email), !ref($.event.data.deal_value)",
          },
        },
        {
          id: "2",
          kind: "slack_send_message",
          name: "Alert Sales on Slack",
          inputs: {
            channel: "#sales-alerts",
            message: "🔥 New lead received! Check Google Sheets for details.",
          },
        },
      ],
      edges: [
        { from: "$source", to: "1" },
        { from: "1", to: "2" },
      ],
    },
  },

  // ─── 4. Support Ticket Escalation ────────────────────────────────────────
  {
    name: "Support Ticket Escalation",
    description: "Alerts the support channel when a new ticket is opened.",
    trigger_type: "webhook",
    trigger_config: { type: "webhook" },
    definition: {
      actions: [
        {
          id: "1",
          kind: "slack_send_message",
          name: "Escalate to Support",
          inputs: {
            channel: "#support-escalations",
            message: "⚠️ New support ticket opened — please investigate.",
          },
        },
      ],
      edges: [{ from: "$source", to: "1" }],
    },
  },
];

/**
 * Insert demo workflows for a newly created team.
 * Runs fire-and-forget style — errors are swallowed so team creation never fails.
 */
export async function seedDemoWorkflows(
  db: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>,
  teamId: string,
  userId: string,
) {
  for (const wf of DEMO_WORKFLOWS) {
    const { data: workflow, error } = await db
      .from("workflows")
      .insert({
        team_id: teamId,
        name: wf.name,
        description: wf.description,
        status: "active",
        trigger_type: wf.trigger_type,
        trigger_config: wf.trigger_config,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error || !workflow) continue;

    await db.from("workflow_versions").insert({
      workflow_id: workflow.id,
      version_number: 1,
      definition: wf.definition,
      created_by: userId,
    });
  }
}
