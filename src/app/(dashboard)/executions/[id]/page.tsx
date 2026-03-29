"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { WorkflowExecution, ExecutionStep, WorkflowDefinition } from "@/types/workflow";

export default function ExecutionDetailPage() {
  const params = useParams<{ id: string }>();
  const [execution, setExecution] = useState<WorkflowExecution | null>(null);
  const [steps, setSteps] = useState<ExecutionStep[]>([]);
  const [definition, setDefinition] = useState<WorkflowDefinition | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/executions/${params.id}`);
        if (!res.ok) return;
        const data = await res.json();
        setExecution(data.execution);
        setSteps(data.steps ?? []);
        if (data.definition) setDefinition(data.definition);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  async function cancelExecution() {
    if (!execution) return;
    await fetch(`/api/executions/${execution.id}`, { method: "POST" });
    setExecution((prev) => prev ? { ...prev, status: "cancelled" } : prev);
  }

  const statusColors: Record<string, string> = {
    pending: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    running: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    completed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    failed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    skipped: "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500",
    cancelled: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  };

  if (loading) return <div className="p-6 text-zinc-500">Loading...</div>;
  if (!execution) return <div className="p-6 text-red-500">Execution not found</div>;

  return (
    <div className="p-6 max-w-4xl">
      <Link
        href="/executions"
        className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mb-4 inline-block"
      >
        ← All Executions
      </Link>

      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Execution
        </h1>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[execution.status] ?? ""}`}>
          {execution.status}
        </span>
        {execution.status === "running" && (
          <button
            onClick={cancelExecution}
            className="ml-auto px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div>
          <p className="text-xs text-zinc-500">Execution ID</p>
          <p className="text-sm font-mono text-zinc-900 dark:text-zinc-100">{execution.id}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Workflow</p>
          <Link
            href={`/workflows/${execution.workflow_id}`}
            className="text-sm text-zinc-900 dark:text-zinc-100 hover:underline"
          >
            {execution.workflow_id}
          </Link>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Started</p>
          <p className="text-sm text-zinc-900 dark:text-zinc-100">
            {new Date(execution.started_at).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Completed</p>
          <p className="text-sm text-zinc-900 dark:text-zinc-100">
            {execution.completed_at ? new Date(execution.completed_at).toLocaleString() : "—"}
          </p>
        </div>
        {execution.error && (
          <div className="col-span-2">
            <p className="text-xs text-zinc-500">Error</p>
            <p className="text-sm text-red-500 font-mono">{execution.error}</p>
          </div>
        )}
      </div>

      {/* Trigger Data */}
      {execution.trigger_data && Object.keys(execution.trigger_data).length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Trigger Data
          </h2>
          <pre className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-mono overflow-x-auto text-zinc-700 dark:text-zinc-300">
            {JSON.stringify(execution.trigger_data, null, 2)}
          </pre>
        </div>
      )}

      {/* Execution Steps */}
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
        Steps ({steps.length})
      </h2>
      {steps.length === 0 ? (
        <p className="text-zinc-500 text-sm">No steps recorded yet.</p>
      ) : (
        <div className="space-y-3">
          {steps.map((step, i) => {
            const nodeInfo = definition?.actions.find((a) => a.id === step.node_id);
            return (
              <details
                key={step.id}
                className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden"
              >
                <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <span className="text-xs text-zinc-400 w-6">{i + 1}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[step.status] ?? ""}`}>
                    {step.status}
                  </span>
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {step.step_name}
                  </span>
                  {nodeInfo && (
                    <span className="text-xs text-zinc-400">
                      ({nodeInfo.kind}: {nodeInfo.name})
                    </span>
                  )}
                  <span className="ml-auto text-xs text-zinc-400">
                    {step.started_at ? new Date(step.started_at).toLocaleTimeString() : "—"}
                    {step.completed_at && ` → ${new Date(step.completed_at).toLocaleTimeString()}`}
                  </span>
                </summary>
                <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                  {step.input_data && (
                    <div className="mb-2">
                      <p className="text-xs text-zinc-500 mb-1 font-medium">Input</p>
                      <pre className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 overflow-x-auto">
                        {JSON.stringify(step.input_data, null, 2)}
                      </pre>
                    </div>
                  )}
                  {step.output_data && (
                    <div className="mb-2">
                      <p className="text-xs text-zinc-500 mb-1 font-medium">Output</p>
                      <pre className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 overflow-x-auto">
                        {JSON.stringify(step.output_data, null, 2)}
                      </pre>
                    </div>
                  )}
                  {step.error && (
                    <div>
                      <p className="text-xs text-zinc-500 mb-1 font-medium">Error</p>
                      <pre className="text-[11px] font-mono text-red-500 overflow-x-auto">
                        {step.error}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
