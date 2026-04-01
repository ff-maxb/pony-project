import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/admin";
import { engineActions } from "../engine-actions";
import { createExecutionLogger, type ExecutionLogger } from "@/lib/execution-logger";

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
  logger: ExecutionLogger;
}) {
  const log = args.logger;
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
  const triggerData = (eventData.triggerData as Record<string, unknown>) ?? {};
  // Initialize variables from trigger data (workflow variables set by the trigger)
  const variables: Record<string, unknown> = { ...triggerData };
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

    log.info(`Processing node "${from}"`, { edges: edges.length, sourceOutput });

    for (const edge of edges) {
      const passes = edgePasses(edge, sourceOutput);
      log.info(`Edge ${edge.from} → ${edge.to} (${passes ? "passes" : "skipped"})`, { conditional: edge.conditional ?? null });
      if (!passes) continue;
      const action = actionById.get(edge.to);
      if (!action || executed.has(action.id)) continue;

      const actionDef = actionsByKind.get(action.kind);
      if (!actionDef) throw new Error(`Unknown action kind: ${action.kind}`);

      // For builtin:if, keep the raw condition string (interpolating it inline
      // into JSON produces invalid JSON for non-empty values) and inject the
      // current runtime variables so the handler can evaluate refs correctly.
      const resolvedInputs = action.kind === "builtin:if"
        ? { condition: action.inputs?.condition, _vars: { ...variables } }
        : ((resolveInputs(action.inputs ?? {}) as Record<string, unknown>) ?? {});

      log.info(`Executing action "${action.name ?? action.kind}"`, {
        kind: action.kind,
        nodeId: action.id,
        inputs: action.kind === "builtin:if"
          ? { condition: resolvedInputs.condition, vars_keys: Object.keys((resolvedInputs._vars as object) ?? {}) }
          : resolvedInputs,
      });

      const workflowAction = {
        ...action,
        inputs: resolvedInputs,
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

      log.info(`Action "${action.name ?? action.kind}" completed`, { kind: action.kind, nodeId: action.id, result });

        if (action.kind === "logic_set_variables" && result && typeof result === "object" && !Array.isArray(result)) {
          Object.assign(variables, result as Record<string, unknown>);
          log.info("Variables updated", { variables });
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

    const logger = createExecutionLogger(executionId);

    try {
      // Run the workflow via our action graph executor.
      logger.info("Workflow started");
      await runWorkflow({
        event: event as { data: Record<string, unknown> },
        step,
        workflow,
        logger,
      });
      logger.info("Workflow completed");

      // Mark execution completed
      await step.run("mark-execution-completed", async () => {
        await db
          .from("workflow_executions")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", executionId);
      });

      return { executionId, status: "completed" };
    } catch (err) {
      // NOTE: Do NOT call step.run() inside this catch block — doing so while
      // rethrowing corrupts Inngest's step state machine and causes the function
      // to get permanently stuck. Update the DB directly instead.
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error("Workflow failed", { error: errorMsg });
      try {
        await db
          .from("workflow_executions")
          .update({ status: "failed", completed_at: new Date().toISOString(), error: errorMsg })
          .eq("id", executionId);
      } catch (dbErr) {
        console.error(`[execute-workflow] failed to mark execution as failed in DB`, dbErr);
      }
      throw err;
    }
  }
);
