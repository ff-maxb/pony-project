import { Nango } from "@nangohq/node";

function getNango() {
  const secretKey = process.env.NANGO_SECRET_KEY;
  if (!secretKey) throw new Error("Missing NANGO_SECRET_KEY");
  return new Nango({ secretKey });
}

export async function executeSlackSendMessage(
  connectionId: string,
  config: { channel: string; message: string }
) {
  const nango = getNango();
  const resp = await nango.proxy({
    method: "POST",
    endpoint: "/api/chat.postMessage",
    providerConfigKey: "slack",
    connectionId,
    data: {
      channel: config.channel,
      text: config.message,
    },
  });
  return resp.data;
}

export async function executeGmailSendEmail(
  connectionId: string,
  config: { to: string; subject: string; body: string }
) {
  const nango = getNango();
  // Gmail API requires base64url-encoded RFC 2822 message
  const message = [
    `To: ${config.to}`,
    `Subject: ${config.subject}`,
    "",
    config.body,
  ].join("\r\n");

  const encoded = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const resp = await nango.proxy({
    method: "POST",
    endpoint: "/gmail/v1/users/me/messages/send",
    providerConfigKey: "gmail",
    connectionId,
    data: { raw: encoded },
  });
  return resp.data;
}

export async function executeGoogleSheetsAppendRow(
  connectionId: string,
  config: { spreadsheet_id: string; sheet_name: string; values: string[] }
) {
  const nango = getNango();
  const range = `${config.sheet_name}!A1`;
  const resp = await nango.proxy({
    method: "POST",
    endpoint: `/v4/spreadsheets/${config.spreadsheet_id}/values/${encodeURIComponent(range)}:append`,
    providerConfigKey: "google-sheets",
    connectionId,
    params: {
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
    },
    data: {
      values: [config.values],
    },
  });
  return resp.data;
}

export async function executeHttpRequest(config: {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
}) {
  const resp = await fetch(config.url, {
    method: config.method,
    headers: config.headers,
    body: config.method !== "GET" ? config.body : undefined,
  });
  const data = await resp.json().catch(() => resp.text());
  return { status: resp.status, data };
}

async function linearGraphQL(
  connectionId: string,
  query: string,
  variables: Record<string, unknown>
) {
  const nango = getNango();
  // Get the access token directly and call Linear's API ourselves.
  // Using nango.proxy for GraphQL endpoints can be unreliable.
  const connection = await nango.getConnection("linear", connectionId);
  const credentials = connection.credentials as Record<string, unknown>;
  const token = (credentials.access_token ?? credentials.token ?? credentials.apiKey) as string | undefined;
  if (!token) {
    console.error("[linearGraphQL] credentials shape:", Object.keys(credentials));
    throw new Error("No Linear access token found");
  }

  const resp = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => "");
    console.error("[linearGraphQL] HTTP error", resp.status, errBody);
    throw new Error(`Linear API error: ${resp.status} ${resp.statusText} — ${errBody}`);
  }
  const body = (await resp.json()) as { data?: unknown; errors?: Array<{ message: string }> };
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join("; "));
  return body.data;
}

export async function fetchLinearTeams(connectionId: string): Promise<Array<{ id: string; name: string; key: string }>> {
  const query = `
    query Teams {
      teams {
        nodes { id name key }
      }
    }
  `;
  const data = (await linearGraphQL(connectionId, query, {})) as {
    teams: { nodes: Array<{ id: string; name: string; key: string }> };
  };
  return data.teams.nodes;
}

export async function executeLinearCreateIssue(
  connectionId: string,
  config: {
    team_id: string;
    title: string;
    description?: string;
    priority?: number;
    assignee_id?: string;
  }
) {
  const input: Record<string, unknown> = {
    teamId: config.team_id,
    title: config.title,
  };
  if (config.description) input.description = config.description;
  if (config.priority !== undefined) input.priority = config.priority;
  if (config.assignee_id) input.assigneeId = config.assignee_id;

  const query = `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          title
          url
          priority
          state { name }
        }
      }
    }
  `;
  const data = (await linearGraphQL(connectionId, query, { input })) as {
    issueCreate: { success: boolean; issue: Record<string, unknown> };
  };
  if (!data.issueCreate.success) throw new Error("Linear issue creation failed");
  return data.issueCreate.issue;
}

export async function executeLinearUpdateIssue(
  connectionId: string,
  config: {
    issue_id: string;
    title?: string;
    description?: string;
    state_id?: string;
    priority?: number;
  }
) {
  const input: Record<string, unknown> = {};
  if (config.title) input.title = config.title;
  if (config.description) input.description = config.description;
  if (config.state_id) input.stateId = config.state_id;
  if (config.priority !== undefined) input.priority = config.priority;

  const query = `
    mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success
        issue {
          id
          identifier
          title
          url
          priority
          state { name }
        }
      }
    }
  `;
  const data = (await linearGraphQL(connectionId, query, { id: config.issue_id, input })) as {
    issueUpdate: { success: boolean; issue: Record<string, unknown> };
  };
  if (!data.issueUpdate.success) throw new Error("Linear issue update failed");
  return data.issueUpdate.issue;
}

export async function executeCalendlyCreateSchedulingLink(
  connectionId: string,
  config: { event_type_uri: string; max_event_count?: number }
) {
  const nango = getNango();
  const resp = await nango.proxy({
    method: "POST",
    endpoint: "/scheduling_links",
    providerConfigKey: "calendly",
    connectionId,
    data: {
      max_event_count: config.max_event_count ?? 1,
      owner: config.event_type_uri,
      owner_type: "EventType",
    },
  });
  return resp.data;
}

// =============================================
// SendGrid — direct SDK (not via Nango)
// =============================================

export async function executeSendGridSendEmail(config: {
  to: string;
  from: string;
  subject: string;
  body: string;
}) {
  const sgMail = await import("@sendgrid/mail");
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error("Missing SENDGRID_API_KEY environment variable");
  sgMail.default.setApiKey(apiKey);

  const [response] = await sgMail.default.send({
    to: config.to,
    from: config.from,
    subject: config.subject,
    html: config.body,
  });

  return { statusCode: response.statusCode, messageId: response.headers["x-message-id"] };
}

// =============================================
// Twilio — direct SDK (not via Nango)
// =============================================

export async function executeTwilioSendSms(config: {
  to: string;
  from: string;
  message: string;
}) {
  const twilio = await import("twilio");
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) throw new Error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN environment variables");

  const client = twilio.default(accountSid, authToken);
  const result = await client.messages.create({
    to: config.to,
    from: config.from,
    body: config.message,
  });

  return { sid: result.sid, status: result.status, to: result.to, from: result.from };
}
