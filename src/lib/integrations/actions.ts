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
