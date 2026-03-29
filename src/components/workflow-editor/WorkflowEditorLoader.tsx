"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Workflow } from "@inngest/workflow-kit";
import type { Workflow as WorkflowRecord, WorkflowExecution } from "@/types/workflow";

type Tab = "builder" | "enrollment" | "logs";

const TABS: { id: Tab; label: string }[] = [
  { id: "builder", label: "Builder" },
  { id: "enrollment", label: "Enrollment History" },
  { id: "logs", label: "Execution Logs" },
];

/**
 * Migrate a persisted workflow definition to the @inngest/workflow-kit format.
 * Definitions saved before the migration used a ReactFlow format
 * ({ nodes[], edges[{ source, target }] }). Those edges lack `from`/`to`,
 * which causes dagre to create phantom nodes and crash the editor.
 */
function toInngestWorkflow(raw: unknown): Workflow {
  const empty: Workflow = { actions: [], edges: [] };
  if (!raw || typeof raw !== "object") return empty;

  const def = raw as Record<string, unknown>;

  // Already new format
  if (Array.isArray(def.actions)) return def as unknown as Workflow;

  // Old ReactFlow format: { nodes[], edges[{id,source,target}] }
  const nodes = def.nodes as Array<Record<string, unknown>> | undefined;
  const oldEdges = def.edges as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(nodes)) return empty;

  // Find the trigger node id so we can map it to "$source"
  const triggerNode = nodes.find((n) => n.type === "trigger");
  const triggerId = triggerNode?.id as string | undefined;

  const actions = nodes
    .filter((n) => n.type === "action")
    .map((n) => {
      const data = n.data as Record<string, unknown> | undefined;
      return {
        id: n.id as string,
        kind: (data?.actionKind as string) ?? "unknown",
        name: (data?.label as string) ?? "Action",
        inputs: (data?.config as Record<string, unknown>) ?? {},
      };
    });

  const edges = (oldEdges ?? [])
    .filter((e) => e.source && e.target)
    .map((e) => ({
      from: e.source === triggerId ? "$source" : (e.source as string),
      to: e.target as string,
    }));

  return { actions, edges };
}

const WorkflowCanvas = dynamic(
  () => import("@/components/workflow-editor/WorkflowCanvas"),
  { ssr: false }
);

interface Props {
  workflowId: string;
}

export function WorkflowEditorLoader({ workflowId }: Props) {
  const [loading, setLoading] = useState(true);
  const [workflowRecord, setWorkflowRecord] = useState<WorkflowRecord | null>(null);
  const [definition, setDefinition] = useState<Workflow | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("builder");
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [execLoading, setExecLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/workflows/${workflowId}`);
        if (!res.ok) throw new Error("Failed to load workflow");
        const data = await res.json();
        setWorkflowRecord(data);
        if (data.latest_version?.definition) {
          setDefinition(toInngestWorkflow(data.latest_version.definition));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [workflowId]);

  useEffect(() => {
    if (activeTab !== "enrollment" && activeTab !== "logs") return;
    setExecLoading(true);
    fetch(`/api/workflows/${workflowId}/executions?limit=50`)
      .then((r) => r.json())
      .then((data) => setExecutions(Array.isArray(data) ? data : []))
      .catch(() => setExecutions([]))
      .finally(() => setExecLoading(false));
  }, [activeTab, workflowId]);

  async function handleSave(workflow: Workflow) {
    const res = await fetch(`/api/workflows/${workflowId}/definition`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ definition: workflow }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error("Failed to save workflow definition", res.status, body);
      const msg = body?.error ?? `Save failed (${res.status})`;
      toast.error(msg);
      throw new Error(msg);
    }
    toast.success("Workflow saved");
  }

  function startEditingName() {
    setNameValue(workflowRecord?.name ?? "");
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.select(), 0);
  }

  async function commitName() {
    setEditingName(false);
    if (!nameValue.trim() || nameValue === workflowRecord?.name) return;
    await handleSettingsSave({ name: nameValue.trim() });
  }

  async function handleSettingsSave(updates: { name?: string; description?: string; status?: string }) {
    await fetch(`/api/workflows/${workflowId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const res = await fetch(`/api/workflows/${workflowId}`);
    if (res.ok) setWorkflowRecord(await res.json());
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        Loading editor...
      </div>
    );
  }

  const execStatusColors: Record<string, string> = {
    pending: "text-zinc-400",
    running: "text-blue-500",
    completed: "text-green-500",
    failed: "text-red-500",
    cancelled: "text-yellow-500",
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950">
      {/* Tab content — fills all space */}
      <div className="flex-1 overflow-hidden relative">
        {/* Floating Back + name — top-left, same row */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
          <Link
            href="/workflows"
            className="flex items-center px-3 py-1.5 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-xl text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 shadow-lg border border-zinc-200/80 dark:border-zinc-700/80 transition-colors shrink-0"
          >
            ← Back
          </Link>
          <div className="flex items-center bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-xl shadow-lg border border-zinc-200/80 dark:border-zinc-700/80">
            {editingName ? (
              <input
                ref={nameInputRef}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditingName(false); }}
                className="px-3 py-1.5 text-sm font-semibold bg-transparent text-zinc-800 dark:text-zinc-100 outline-none w-44"
              />
            ) : (
              <span className="px-3 py-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-100 truncate max-w-[180px]">
                {workflowRecord?.name ?? "Workflow"}
              </span>
            )}
            <button
              onClick={startEditingName}
              className="pr-2.5 pl-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              title="Rename workflow"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Floating tab bar — top-center */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-2 py-1.5 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-2xl shadow-xl border border-zinc-200/80 dark:border-zinc-700/80 pointer-events-auto">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "builder" && (
          <WorkflowCanvas
            workflowId={workflowId}
            teamId={workflowRecord?.team_id}
            initialDefinition={definition ?? undefined}
            onSave={handleSave}
            status={workflowRecord?.status}
          />
        )}
        {/* Enrollment History */}
        {activeTab === "enrollment" && (
          <ExecutionsTab
            executions={executions}
            loading={execLoading}
            workflowId={workflowId}
            statusColors={execStatusColors}
            title="Enrollment History"
            emptyText="No enrollments yet."
          />
        )}

        {/* Execution Logs */}
        {activeTab === "logs" && (
          <ExecutionsTab
            executions={executions}
            loading={execLoading}
            workflowId={workflowId}
            statusColors={execStatusColors}
            title="Execution Logs"
            emptyText="No execution logs yet."
            showDetails
          />
        )}


      </div>
    </div>
  );
}

// ─── Settings tab ────────────────────────────────────────────────────────────

function SettingsTab({
  workflow,
  onSave,
}: {
  workflow: WorkflowRecord | null;
  onSave: (updates: { name?: string; description?: string; status?: string }) => Promise<void>;
}) {
  const [name, setName] = useState(workflow?.name ?? "");
  const [description, setDescription] = useState(workflow?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({ name, description });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-xl mx-auto py-10 px-6">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Workflow Settings</h2>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <div className="pt-1">
          <span className="text-xs text-zinc-400">Trigger type: </span>
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{workflow?.trigger_type ?? "—"}</span>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : saved ? "✓ Saved" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={() => onSave({ status: workflow?.status === "active" ? "paused" : "active" })}
            className="px-5 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            {workflow?.status === "active" ? "⏸ Pause workflow" : "▶ Activate workflow"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Executions / Logs tab ───────────────────────────────────────────────────

function ExecutionsTab({
  executions,
  loading,
  workflowId,
  statusColors,
  title,
  emptyText,
  showDetails = false,
}: {
  executions: WorkflowExecution[];
  loading: boolean;
  workflowId: string;
  statusColors: Record<string, string>;
  title: string;
  emptyText: string;
  showDetails?: boolean;
}) {
  void workflowId;
  void title;

  // Group executions by calendar date
  const groups: { date: string; items: WorkflowExecution[] }[] = [];
  for (const exec of executions) {
    const date = new Date(exec.started_at).toLocaleDateString(undefined, {
      weekday: "short", month: "short", day: "numeric", year: "numeric",
    });
    const last = groups[groups.length - 1];
    if (last && last.date === date) {
      last.items.push(exec);
    } else {
      groups.push({ date, items: [exec] });
    }
  }

  const statusIcon: Record<string, string> = {
    running: "●",
    completed: "✓",
    failed: "✗",
    cancelled: "⊘",
    pending: "○",
  };

  return (
    <div className="max-w-2xl mx-auto pt-20 pb-10 px-6">
      {loading ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : executions.length === 0 ? (
        <p className="text-sm text-zinc-400">{emptyText}</p>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.date}>
              {/* Date label */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider whitespace-nowrap">
                  {group.date}
                </span>
                <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
              </div>

              {/* Timeline entries */}
              <div className="relative pl-6">
                {/* Vertical line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-zinc-200 dark:bg-zinc-700" />

                <div className="space-y-3">
                  {group.items.map((exec) => (
                    <Link
                      key={exec.id}
                      href={`/executions/${exec.id}`}
                      className="relative flex items-start gap-4 group"
                    >
                      {/* Timeline dot */}
                      <div
                        className={`absolute -left-6 mt-[11px] w-3.5 h-3.5 rounded-full border-2 border-white dark:border-zinc-950 flex items-center justify-center text-[8px] font-bold transition-transform group-hover:scale-110 ${
                          exec.status === "completed"
                            ? "bg-emerald-400"
                            : exec.status === "running"
                            ? "bg-blue-400"
                            : exec.status === "failed"
                            ? "bg-red-400"
                            : exec.status === "cancelled"
                            ? "bg-amber-400"
                            : "bg-zinc-300 dark:bg-zinc-600"
                        }`}
                      />

                      {/* Card */}
                      <div className="flex-1 flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 group-hover:border-zinc-300 dark:group-hover:border-zinc-700 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-semibold ${statusColors[exec.status]}`}>
                            {statusIcon[exec.status] ?? "○"} {exec.status}
                          </span>
                          <span className="text-xs text-zinc-400 font-mono">{exec.id.slice(0, 8)}</span>
                          {showDetails && exec.error && (
                            <span className="text-xs text-red-400 truncate max-w-[200px]">{exec.error}</span>
                          )}
                        </div>
                        <span className="text-xs text-zinc-400 shrink-0">
                          {new Date(exec.started_at).toLocaleTimeString(undefined, {
                            hour: "2-digit", minute: "2-digit", second: "2-digit",
                          })}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
