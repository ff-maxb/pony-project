"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Workflow, WorkflowVersion, WorkflowExecution } from "@/types/workflow";

export default function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [workflow, setWorkflow] = useState<Workflow & { latest_version?: WorkflowVersion } | null>(null);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkflow();
    fetchExecutions();
  }, [id]);

  async function fetchWorkflow() {
    const res = await fetch(`/api/workflows/${id}`);
    if (res.ok) setWorkflow(await res.json());
    setLoading(false);
  }

  async function fetchExecutions() {
    const res = await fetch(`/api/workflows/${id}/executions?limit=20`);
    if (res.ok) setExecutions(await res.json());
  }

  async function executeWorkflow() {
    await fetch(`/api/workflows/${id}/execute`, { method: "POST" });
    fetchExecutions();
  }

  async function toggleStatus() {
    if (!workflow) return;
    const newStatus = workflow.status === "active" ? "paused" : "active";
    await fetch(`/api/workflows/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchWorkflow();
  }

  const statusColors: Record<string, string> = {
    draft: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  };

  const execStatusColors: Record<string, string> = {
    pending: "text-zinc-500",
    running: "text-blue-500",
    completed: "text-green-500",
    failed: "text-red-500",
    cancelled: "text-yellow-500",
  };

  if (loading) return <div className="text-sm text-zinc-500">Loading...</div>;
  if (!workflow) return <div className="text-sm text-red-500">Workflow not found</div>;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/workflows" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
              ← Workflows
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{workflow.name}</h1>
          {workflow.description && (
            <p className="text-sm text-zinc-500 mt-1">{workflow.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[workflow.status]}`}>
              {workflow.status}
            </span>
            <span className="text-xs text-zinc-500">
              Trigger: {workflow.trigger_type}
            </span>
            {workflow.latest_version && (
              <span className="text-xs text-zinc-500">
                v{workflow.latest_version.version_number}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={executeWorkflow}
            className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
          >
            ▶ Run Now
          </button>
          <Link
            href={`/workflows/${id}/edit`}
            className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Edit
          </Link>
          <button
            onClick={toggleStatus}
            className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            {workflow.status === "active" ? "⏸ Pause" : "▶ Activate"}
          </button>
        </div>
      </div>

      {workflow.trigger_type === "webhook" && (
        <div className="mb-6 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">Webhook URL</h3>
          <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg block">
            {typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/{workflow.id}
          </code>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Recent Executions</h2>
        {executions.length === 0 ? (
          <p className="text-sm text-zinc-500">No executions yet. Run the workflow to see results here.</p>
        ) : (
          <div className="space-y-2">
            {executions.map((exec) => (
              <Link
                key={exec.id}
                href={`/executions/${exec.id}`}
                className="flex items-center justify-between p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${execStatusColors[exec.status]}`}>
                    {exec.status === "running" ? "●" : exec.status === "completed" ? "✓" : exec.status === "failed" ? "✗" : "○"} {exec.status}
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">{exec.id.slice(0, 8)}</span>
                </div>
                <span className="text-xs text-zinc-500">
                  {new Date(exec.started_at).toLocaleString()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
