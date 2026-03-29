"use client";

import { useEffect, useState } from "react";
import { useTeam } from "@/hooks/useTeam";
import Link from "next/link";
import type { WorkflowExecution } from "@/types/workflow";

interface ExecutionWithWorkflow extends WorkflowExecution {
  workflows?: { name: string };
}

export default function ExecutionsListPage() {
  const { activeTeam } = useTeam();
  const [executions, setExecutions] = useState<ExecutionWithWorkflow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeTeam) return;
    async function load() {
      setLoading(true);
      try {
        // Load all workflows for the team, then all their executions
        const wfRes = await fetch(`/api/workflows?teamId=${activeTeam!.id}`);
        if (!wfRes.ok) return;
        const wfData = await wfRes.json();
        const workflows = Array.isArray(wfData) ? wfData : (wfData.workflows ?? []);

        const allExecs: ExecutionWithWorkflow[] = [];
        for (const wf of workflows) {
          const exRes = await fetch(`/api/workflows/${wf.id}/executions?limit=20`);
          if (exRes.ok) {
            const exData = await exRes.json();
            const executions = Array.isArray(exData) ? exData : (exData.executions ?? []);
            allExecs.push(
              ...executions.map((e: WorkflowExecution) => ({ ...e, workflows: { name: wf.name } }))
            );
          }
        }
        allExecs.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
        setExecutions(allExecs.slice(0, 50));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeTeam]);

  const statusColors: Record<string, string> = {
    pending: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    running: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    completed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    failed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    cancelled: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  };

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        Executions
      </h1>

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : executions.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <p className="text-lg mb-1">No executions yet</p>
          <p className="text-sm">Run a workflow to see its execution history here.</p>
        </div>
      ) : (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900 text-left text-xs text-zinc-500 uppercase tracking-wider">
                <th className="px-4 py-3">Workflow</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {executions.map((ex) => (
                <tr key={ex.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                    {ex.workflows?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[ex.status] ?? ""}`}>
                      {ex.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {new Date(ex.started_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {ex.completed_at ? new Date(ex.completed_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/executions/${ex.id}`}
                      className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    >
                      View Details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
