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
          description: "The message text to send. Use {{event.data.field}} to reference trigger data.",
        }),
        fieldType: "textarea",
      },
    },
  },
  {
    kind: "gmail_send_email",
    name: "Send Email (Gmail)",
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
];
