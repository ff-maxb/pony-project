import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/admin";
import { engineActions } from "../engine-actions";

type Workflow = {
  actions: Array<{ id: string; kind: string; name?: string; inputs?: Record<string, unknown> }>;
  edges: Array<{
    from: string;
    to: string;
    conditional?: { type: "if" | "else" | "match"; ref: string; value?: unknown };
  }>;
};

async function runWorkflow(args: {
  event: { data: Record<string, unknown> };
  step: unknown;
  workflow: Workflow;
}) {
  const actionById = new Map(args.workflow.actions.map((a) => [a.id, a]));
  const actionsByKind = new Map(engineActions.map((a) => [a.kind, a]));
  const outgoing = new Map<string, Workflow["edges"]>();

  for (const edge of args.workflow.edges) {
    const list = outgoing.get(edge.from) ?? [];
    list.push(edge);
    outgoing.set(edge.from, list);
  }

  const outputs = new Map<string, unknown>();
  const eventData = args.event?.data ?? {};
  const variables: Record<string, unknown> = {
    name: eventData.name,
    email: eventData.email,
    phone: eventData.phone,
  };
  const executed = new Set<string>();
  const queue: string[] = ["$source"];

  const evalPath = (root: unknown, path: string) => {
    const clean = path
      .replace(/^\$\.?/, "")
      .replace(/\[(\d+)\]/g, ".$1");
    if (!clean) return root;
    return clean.split(".").reduce<unknown>((acc, key) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
      return undefined;
    }, root);
  };

  const buildContext = () => {
    const steps = Object.fromEntries(outputs.entries());
    return {
      event: args.event,
      variables,
      vars: variables,
      steps,
      ...steps,
    };
  };

  const resolvePath = (path: string, sourceOutput?: unknown) => {
    if (path.startsWith("$.result")) {
      return evalPath(sourceOutput, path);
    }

    const ctx = buildContext();
    return evalPath(ctx, path);
  };

  const resolveRef = (ref: string, sourceOutput?: unknown) => {
    const m = ref.match(/^!ref\((.+)\)$/);
    const path = (m ? m[1] : ref).trim();
    return resolvePath(path, sourceOutput);
  };

  const toInterpolationString = (value: unknown) => {
    if (value === undefined || value === null) return "";
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return "";
      }
    }
    return String(value);
  };

  const interpolateString = (input: string) => {
    // Supports both legacy !ref($.path) and {{ path }} placeholders in text inputs.
    const withRefs = input.replace(/!ref\(([^)]+)\)/g, (_match, path: string) =>
      toInterpolationString(resolvePath(path.trim()))
    );

    return withRefs.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, expr: string) =>
      toInterpolationString(resolvePath(expr.trim()))
    );
  };

  const resolveInputs = (value: unknown): unknown => {
    if (typeof value === "string") {
      const m = value.match(/^!ref\((.+)\)$/);
      if (m) return resolvePath(m[1].trim());
      return interpolateString(value);
    }
    if (Array.isArray(value)) return value.map(resolveInputs);
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = resolveInputs(v);
      }
      return out;
    }
    return value;
  };

  const edgePasses = (edge: Workflow["edges"][number], sourceOutput: unknown) => {
    if (!edge.conditional) return true;
    const value = resolveRef(edge.conditional.ref, sourceOutput);
    if (edge.conditional.type === "if") return !!value;
    if (edge.conditional.type === "else") return !value;
    return value === edge.conditional.value;
  };

  while (queue.length > 0) {
    const from = queue.shift()!;
    const edges = outgoing.get(from) ?? [];
    const sourceOutput = from === "$source" ? { result: true } : outputs.get(from);

    for (const edge of edges) {
      if (!edgePasses(edge, sourceOutput)) continue;
      const action = actionById.get(edge.to);
      if (!action || executed.has(action.id)) continue;

      const actionDef = actionsByKind.get(action.kind);
      if (!actionDef) throw new Error(`Unknown action kind: ${action.kind}`);

      const workflowAction = {
        ...action,
        inputs: (resolveInputs(action.inputs ?? {}) as Record<string, unknown>) ?? {},
      };

      const result = await (actionDef.handler as (handlerArgs: {
        event: unknown;
        step: unknown;
        workflow: Workflow;
        workflowAction: typeof workflowAction;
        state: Map<string, unknown>;
      }) => Promise<unknown>)({
        event: args.event,
        step: args.step,
        workflow: args.workflow,
        workflowAction,
        state: outputs,
      });

        if (action.kind === "logic_set_variables" && result && typeof result === "object" && !Array.isArray(result)) {
          Object.assign(variables, result as Record<string, unknown>);
        }

      outputs.set(action.id, result);
      executed.add(action.id);
      queue.push(action.id);
    }
  }
}

export const executeWorkflow = inngest.createFunction(
  {
    id: "execute-workflow",
    triggers: [{ event: "workflow/execution.requested" }],
    cancelOn: [
      {
        event: "workflow/execution.cancelled",
        if: "event.data.executionId == async.data.executionId",
      },
    ],
  },
  async ({ event, step }) => {
    const { versionId, executionId } = event.data as {
      workflowId: string;
      versionId: string;
      executionId: string;
      triggerData: Record<string, unknown>;
      teamId: string;
    };

    const db = createAdminClient();

    // Mark execution as running
    await step.run("mark-execution-running", async () => {
      await db
        .from("workflow_executions")
        .update({ status: "running" })
        .eq("id", executionId);
    });

    // Load workflow definition (Inngest Workflow format)
    const workflow = await step.run("load-definition", async () => {
      const { data, error } = await db
        .from("workflow_versions")
        .select("definition")
        .eq("id", versionId)
        .single();
      if (error || !data) throw new Error(`Failed to load version: ${error?.message}`);
      return data.definition as Workflow;
    });

    try {
      // Run the workflow via our action graph executor.
      await runWorkflow({
        event: event as { data: Record<string, unknown> },
        step,
        workflow,
      });

      // Mark execution completed
      await step.run("mark-execution-completed", async () => {
        await db
          .from("workflow_executions")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", executionId);
      });

      return { executionId, status: "completed" };
    } catch (err) {
      await step.run("mark-execution-failed", async () => {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await db
          .from("workflow_executions")
          .update({ status: "failed", completed_at: new Date().toISOString(), error: errorMsg })
          .eq("id", executionId);
      });
      throw err;
    }
  }
);
