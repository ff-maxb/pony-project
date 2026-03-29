"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import type { Workflow } from "@/types/workflow";
import { useTeam } from "@/hooks/useTeam";
import { useRouter } from "next/navigation";
import { Plus, SlidersHorizontal, ChevronDown, Trash2, Pencil } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const TEMPLATES = [
  {
    name: "Slack to Discord Sync",
    description: "Cross-platform messaging bridge with thread support and file attachments.",
    icons: ["💬", "→", "🎮"],
  },
  {
    name: "AI Email Support",
    description: "Automatically categorize and draft responses to customer inquiries using LLMs.",
    icons: ["✉️", "⚡", "🤖"],
  },
  {
    name: "DB to Dashboard",
    description: "Real-time sync between production databases and analytical BI tools.",
    icons: ["🗄️", "〜", "📊"],
  },
];

const STATUS_CONFIG: Record<string, { dot: string; badge: string; label: string }> = {
  active:   { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200",  label: "ACTIVE" },
  draft:    { dot: "bg-zinc-400",    badge: "bg-zinc-50 text-zinc-500 border-zinc-200",            label: "INACTIVE" },
  paused:   { dot: "bg-zinc-400",    badge: "bg-zinc-50 text-zinc-500 border-zinc-200",            label: "INACTIVE" },
};

export default function WorkflowsPage() {
  const router = useRouter();
  const { activeTeam } = useTeam();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [userMap, setUserMap] = useState<Record<string, { name: string; imageUrl: string }>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const fetchUsers = useCallback(async (wfs: Workflow[]) => {
    const ids = [...new Set(wfs.map((w) => w.created_by))].filter(Boolean);
    if (!ids.length) return;
    const res = await fetch(`/api/users?ids=${ids.join(",")}`);
    if (!res.ok) return;
    const data: { id: string; name: string; imageUrl: string }[] = await res.json();
    setUserMap(Object.fromEntries(data.map((u) => [u.id, u])));
  }, []);

  useEffect(() => {
    if (!activeTeam) return;
    fetchWorkflows();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTeam]);

  async function fetchWorkflows() {
    setLoading(true);
    const res = await fetch(`/api/workflows?teamId=${activeTeam!.id}`);
    if (res.ok) {
      const data = await res.json();
      const wfs: Workflow[] = data.workflows ?? data;
      setWorkflows(wfs);
      fetchUsers(wfs);
    }
    setLoading(false);
  }

  async function createWorkflow() {
    if (!activeTeam) return;
    setCreating(true);
    const res = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: activeTeam.id, name: "New Workflow" }),
    });
    if (res.ok) {
      const wf = await res.json();
      window.location.href = `/workflows/${wf.id}/edit`;
    }
    setCreating(false);
  }

  async function deleteWorkflow(workflowId: string) {
    if (!confirm("Delete this workflow?")) return;
    await fetch(`/api/workflows/${workflowId}`, { method: "DELETE" });
    fetchWorkflows();
  }

  function startRename(wf: Workflow) {
    setRenamingId(wf.id);
    setRenameValue(wf.name);
    setTimeout(() => renameInputRef.current?.select(), 0);
  }

  async function commitRename(wfId: string) {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name) return;
    await fetch(`/api/workflows/${wfId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setWorkflows((prev) => prev.map((w) => w.id === wfId ? { ...w, name } : w));
  }

  const filtered = statusFilter === "all"
    ? workflows
    : workflows.filter((wf) => wf.status === statusFilter);

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">My Workflows</h1>
          <p className="text-sm text-zinc-500 mt-1">Monitor and orchestrate your automated operational pipelines.</p>
        </div>
        <button
          onClick={createWorkflow}
          disabled={creating}
          className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          <Plus size={15} />
          New Workflow
        </button>
      </div>

      {/* Recommended Templates */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">Recommended Templates</span>
          <Link href="/templates" className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors">
            Browse more →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {TEMPLATES.map((t) => (
            <div
              key={t.name}
              className="bg-white border border-zinc-200 rounded-xl p-5 hover:border-zinc-300 hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-xl mb-3">
                {t.icons.map((icon, i) => (
                  <span key={i} className={i === 1 ? "text-sm text-zinc-400" : ""}>{icon}</span>
                ))}
              </div>
              <h3 className="text-sm font-semibold text-zinc-900 mb-1">{t.name}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{t.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Active Workflows */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">Active Workflows</span>
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-zinc-200 rounded-md bg-white text-zinc-700 hover:border-zinc-300 focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="draft">Draft</option>
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-zinc-200 rounded-md bg-white text-zinc-700 hover:border-zinc-300 transition-colors">
              <SlidersHorizontal size={12} />
              Filter
            </button>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1fr_1.5fr_1.5fr_72px] gap-4 px-5 py-3 border-b border-zinc-100">
            {["Workflow Name", "Status", "Last Run", "Owner"].map((h) => (
              <span key={h} className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">{h}</span>
            ))}
            <span />
          </div>

          {loading ? (
            <div className="px-5 py-10 text-sm text-zinc-400 text-center">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-zinc-900">No workflows yet</p>
              <p className="text-xs text-zinc-500 mt-1">Create your first workflow to get started.</p>
            </div>
          ) : (
            filtered.map((wf, i) => {
              const cfg = STATUS_CONFIG[wf.status] ?? STATUS_CONFIG.draft;
              const lastRun = formatDistanceToNow(new Date(wf.updated_at), { addSuffix: true });
              return (
                <div
                  key={wf.id}
                  onClick={() => renamingId !== wf.id && router.push(`/workflows/${wf.id}/edit`)}
                  className={`grid grid-cols-[2fr_1fr_1.5fr_1.5fr_72px] gap-4 items-center px-5 py-4 hover:bg-zinc-50 transition-colors cursor-pointer ${
                    i > 0 ? "border-t border-zinc-100" : ""
                  }`}
                >
                  {/* Name */}
                  <div onClick={(e) => renamingId === wf.id && e.stopPropagation()}>
                    {renamingId === wf.id ? (
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => commitRename(wf.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm font-medium text-zinc-900 border-b border-zinc-300 outline-none bg-transparent w-full"
                      />
                    ) : (
                      <p className={`text-sm font-medium ${
                        wf.status === "draft" ? "text-zinc-400" : "text-zinc-900"
                      }`}>
                        {wf.name}
                      </p>
                    )}
                    {wf.description && renamingId !== wf.id && (
                      <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-xs">{wf.description}</p>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold border ${cfg.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>

                  {/* Last run */}
                  <div>
                    <p className="text-sm text-zinc-700">{lastRun}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{wf.trigger_type}</p>
                  </div>

                  {/* Owner */}
                  <div className="flex items-center gap-2">
                    {userMap[wf.created_by]?.imageUrl ? (
                      <img
                        src={userMap[wf.created_by].imageUrl}
                        alt={userMap[wf.created_by].name}
                        className="w-6 h-6 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-medium text-zinc-600 shrink-0">
                        {(userMap[wf.created_by]?.name ?? wf.created_by).slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm text-zinc-700 truncate">
                      {userMap[wf.created_by]?.name ?? wf.created_by.slice(0, 8) + "…"}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); startRename(wf); }}
                      className="p-1.5 rounded hover:bg-zinc-100 text-zinc-300 hover:text-zinc-600 transition-colors"
                      title="Rename"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteWorkflow(wf.id); }}
                      className="p-1.5 rounded hover:bg-red-50 text-zinc-300 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
