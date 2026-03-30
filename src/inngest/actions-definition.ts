import { Type } from "@sinclair/typebox";
import type { PublicEngineAction } from "@inngest/workflow-kit";

/**
 * Public action definitions exposed to the frontend workflow editor.
 * These map to the EngineAction handlers in engine-actions.ts.
 */
export const actionsDefinition: PublicEngineAction[] = [
  {
    kind: "slack_send_message",
    name: "Send Slack Message",
    description: "Send a message to a Slack channel",
    inputs: {
      channel: {
        type: Type.String({
          title: "Channel",
          description: "#channel name or channel ID",
        }),
      },
      message: {
        type: Type.String({
          title: "Message",
          description: "The message text to send. Variables supported: {{event.data.field}}, {{steps.action-id.field}}, or !ref($.event.data.field).",
        }),
        fieldType: "textarea",
      },
    },
  },
  {
    kind: "gmail_send_email",
    name: "Gmail",
    description: "Send an email via Gmail",
    inputs: {
      to: {
        type: Type.String({
          title: "To",
          description: "Recipient email address",
          format: "email",
        }),
      },
      subject: {
        type: Type.String({
          title: "Subject",
        }),
      },
      body: {
        type: Type.String({
          title: "Body",
        }),
        fieldType: "textarea",
      },
    },
  },
  {
    kind: "google_sheets_append_row",
    name: "Google Sheets: Append Row",
    description: "Append a row to a Google Sheets spreadsheet",
    inputs: {
      spreadsheet_id: {
        type: Type.String({
          title: "Spreadsheet ID",
          description: "The ID from the Google Sheets URL",
        }),
      },
      sheet_name: {
        type: Type.String({
          title: "Sheet Name",
          description: "Name of the sheet tab (e.g. Sheet1)",
        }),
      },
      values: {
        type: Type.String({
          title: "Values",
          description: "Comma-separated values to append as a row",
        }),
        fieldType: "text",
      },
    },
  },
  {
    kind: "http_request",
    name: "HTTP Request",
    description: "Make an HTTP request to any URL",
    inputs: {
      url: {
        type: Type.String({
          title: "URL",
          description: "The URL to send the request to",
        }),
      },
      method: {
        type: Type.String({
          title: "Method",
          description: "HTTP method: GET, POST, PUT, PATCH, DELETE",
        }),
      },
      body: {
        type: Type.String({
          title: "Body (JSON)",
          description: "Request body as JSON string",
        }),
        fieldType: "textarea",
      },
    },
  },
  {
    kind: "logic_delay",
    name: "Delay",
    description: "Wait a duration before continuing",
    inputs: {
      duration: {
        type: Type.String({
          title: "Duration",
          description: "How long to wait, e.g. 30s, 5m, 1h, 2h30m",
        }),
      },
    },
  },
  {
    kind: "builtin:if",
    name: "If / Condition",
    description: "Branch based on a condition",
    inputs: {
      condition: {
        type: Type.String({
          title: "Condition (JSON Logic)",
          description: 'JSON Logic expression. e.g. {"==": ["!ref($.event.data.status)", "active"]}',
        }),
        fieldType: "textarea",
      },
    },
    edges: {
      allowAdd: false,
      edges: [
        { name: "True", conditional: { type: "if" as const, ref: "!ref($.result)" } },
        { name: "False", conditional: { type: "else" as const, ref: "!ref($.result)" } },
      ],
    },
  },
  {
    kind: "linear_create_issue",
    name: "Linear: Create Issue",
    description: "Create a new issue in a Linear team",
    inputs: {
      team_id: {
        type: Type.String({
          title: "Team ID",
          description: "Linear team ID (find in team settings URL)",
        }),
      },
      title: {
        type: Type.String({
          title: "Title",
          description: "Issue title",
        }),
      },
      description: {
        type: Type.String({
          title: "Description",
          description: "Issue description (Markdown supported)",
        }),
        fieldType: "textarea",
      },
      priority: {
        type: Type.String({
          title: "Priority",
          description: "0 = No priority, 1 = Urgent, 2 = High, 3 = Medium, 4 = Low",
        }),
      },
      assignee_id: {
        type: Type.String({
          title: "Assignee ID",
          description: "Linear user ID to assign the issue to (optional)",
        }),
      },
    },
  },
  {
    kind: "linear_update_issue",
    name: "Linear: Update Issue",
    description: "Update an existing Linear issue",
    inputs: {
      issue_id: {
        type: Type.String({
          title: "Issue ID",
          description: "Linear issue ID (e.g. from a previous Create Issue step: !ref($.issue.id))",
        }),
      },
      title: {
        type: Type.String({
          title: "Title",
          description: "New title (leave blank to keep existing)",
        }),
      },
      description: {
        type: Type.String({
          title: "Description",
          description: "New description (leave blank to keep existing)",
        }),
        fieldType: "textarea",
      },
      state_id: {
        type: Type.String({
          title: "State ID",
          description: "Linear workflow state ID to set (optional)",
        }),
      },
      priority: {
        type: Type.String({
          title: "Priority",
          description: "0 = No priority, 1 = Urgent, 2 = High, 3 = Medium, 4 = Low",
        }),
      },
    },
  },
  {
    kind: "calendly_create_scheduling_link",
    name: "Calendly: Create Scheduling Link",
    description: "Generate a one-off scheduling link for a Calendly event type",
    inputs: {
      event_type_uri: {
        type: Type.String({
          title: "Event Type URI",
          description: "Calendly event type URI, e.g. https://api.calendly.com/event_types/xxx",
        }),
      },
      max_event_count: {
        type: Type.String({
          title: "Max Uses",
          description: "How many times the link can be used (default: 1)",
        }),
      },
    },
  },
  {
    kind: "logic_set_variables",
    name: "Set Variables",
    description: "Set reusable workflow variables for downstream steps",
    inputs: {
      variables_json: {
        type: Type.String({
          title: "Variables (JSON)",
          description:
            'JSON object of variable names to values. Supports references in values, e.g. {"email":"{{event.data.email}}","issueId":"{{steps.action-1.id}}"}',
        }),
        fieldType: "textarea",
      },
    },
  },
  {
    kind: "sendgrid_send_email",
    name: "Send Email",
    description: "Send an email via SendGrid",
    inputs: {
      to: {
        type: Type.String({
          title: "To",
          description: "Recipient email address",
          format: "email",
        }),
      },
      from: {
        type: Type.String({
          title: "From",
          description: "Sender email address (must be verified in SendGrid)",
          format: "email",
        }),
      },
      subject: {
        type: Type.String({
          title: "Subject",
          description: "Email subject line",
        }),
      },
      body: {
        type: Type.String({
          title: "Body",
          description: "Email body (plain text or HTML)",
        }),
        fieldType: "textarea",
      },
    },
  },
  {
    kind: "twilio_send_sms",
    name: "Send SMS",
    description: "Send an SMS via Twilio",
    inputs: {
      to: {
        type: Type.String({
          title: "To",
          description: "Recipient phone number (E.164 format, e.g. +15551234567)",
        }),
      },
      from: {
        type: Type.String({
          title: "From",
          description: "Twilio phone number to send from (E.164 format)",
        }),
      },
      message: {
        type: Type.String({
          title: "Message",
          description: "SMS message text. Variables supported: {{event.data.field}}, {{steps.action-id.field}}",
        }),
        fieldType: "textarea",
      },
    },
  },
];
