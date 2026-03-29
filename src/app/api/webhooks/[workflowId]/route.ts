import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest } from "next/server";
import { inngest } from "@/inngest/client";

/** Public webhook endpoint — no auth required.
 *  Receives inbound webhooks and triggers workflow executions.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  const { workflowId } = await params;
  const db = createAdminClient();

  // Load workflow
  const { data: workflow } = await db
    .from("workflows")
    .select("*")
    .eq("id", workflowId)
    .eq("trigger_type", "webhook")
    .eq("status", "active")
    .is("deleted_at", null)
    .single();

  if (!workflow) {
    return Response.json({ error: "Workflow not found or not active" }, { status: 404 });
  }

  // Get latest version
  const { data: version } = await db
    .from("workflow_versions")
    .select("id")
    .eq("workflow_id", workflowId)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();

  if (!version) {
    return Response.json({ error: "No workflow version" }, { status: 400 });
  }

  // Parse webhook payload
  let triggerData: Record<string, unknown> = { source: "webhook" };
  try {
    const body = await request.json();
    triggerData = { ...triggerData, data: body };
  } catch {
    // Non-JSON body
    const text = await request.text();
    triggerData = { ...triggerData, data: text };
  }

  // Add headers as metadata
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    if (!key.startsWith("x-") && key !== "authorization") return;
    headers[key] = value;
  });
  triggerData.headers = headers;

  // Create execution
  const { data: execution } = await db
    .from("workflow_executions")
    .insert({
      workflow_id: workflowId,
      workflow_version_id: version.id,
      status: "pending",
      trigger_data: triggerData,
    })
    .select("id")
    .single();

  if (!execution) {
    return Response.json({ error: "Failed to create execution" }, { status: 500 });
  }

  // Dispatch to Inngest
  await inngest.send({
    name: "workflow/execution.requested",
    data: {
      workflowId,
      versionId: version.id,
      executionId: execution.id,
      teamId: workflow.team_id,
      triggerData,
    },
  });

  return Response.json({ executionId: execution.id, status: "triggered" });
}
