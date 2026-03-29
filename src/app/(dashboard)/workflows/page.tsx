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
  active: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "ACTIVE" },
  draft: { dot: "bg-zinc-400", badge: "bg-zinc-50 text-zinc-500 border-zinc-200", label: "INACTIVE" },
  paused: { dot: "bg-zinc-400", badge: "bg-zinc-50 text-zinc-500 border-zinc-200", label: "INACTIVE" },
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
    setWorkflows((prev) => prev.map((w) => (w.id === wfId ? { ...w, name } : w)));
  }

  const filtered = statusFilter === "all" ? workflows : workflows.filter((wf) => wf.status === statusFilter);

  return (
    <div className="mx-auto w-full max-w-6xl landing-fade-up">
      <div className="mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">My Workflows</h1>
          <p className="mt-1 text-sm text-zinc-500">Monitor and orchestrate your automated operational pipelines.</p>
        </div>
      </div>

      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Recommended Templates</span>
          <Link href="/templates" className="text-xs text-zinc-500 transition-colors hover:text-zinc-900">
            Browse more →
          </Link>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {TEMPLATES.map((t) => (
            <div
              key={t.name}
              className="cursor-pointer rounded-2xl border border-zinc-200/80 bg-white/85 p-5 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-[0_14px_28px_rgba(24,24,27,0.07)]"
            >
              <div className="mb-3 flex items-center gap-1.5 text-xl">
                {t.icons.map((icon, i) => (
                  <span key={i} className={i === 1 ? "text-sm text-zinc-400" : ""}>
                    {icon}
                  </span>
                ))}
              </div>
              <h3 className="mb-1 text-sm font-semibold text-zinc-900">{t.name}</h3>
              <p className="text-xs leading-relaxed text-zinc-500">{t.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Active Workflows</span>
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="cursor-pointer appearance-none rounded-lg border border-zinc-200 bg-white px-3 py-2 pr-7 text-xs font-medium text-zinc-700 hover:border-zinc-300 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="draft">Draft</option>
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400" />
            </div>
            <button className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-300">
              <SlidersHorizontal size={12} />
              Filter
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/90 shadow-[0_14px_36px_rgba(24,24,27,0.06)]">
          <div className="grid grid-cols-[2fr_1fr_1.5fr_1.5fr_72px] gap-4 border-b border-zinc-100 bg-zinc-50/70 px-5 py-3">
            {["Workflow Name", "Status", "Last Run", "Owner"].map((h) => (
              <span key={h} className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {h}
              </span>
            ))}
            <span />
          </div>

          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-zinc-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-zinc-900">No workflows yet</p>
              <p className="mt-1 text-xs text-zinc-500">Create your first workflow to get started.</p>
            </div>
          ) : (
            filtered.map((wf, i) => {
              const cfg = STATUS_CONFIG[wf.status] ?? STATUS_CONFIG.draft;
              const lastRun = formatDistanceToNow(new Date(wf.updated_at), { addSuffix: true });

              return (
                <div
                  key={wf.id}
                  onClick={() => renamingId !== wf.id && router.push(`/workflows/${wf.id}/edit`)}
                  className={`grid cursor-pointer grid-cols-[2fr_1fr_1.5fr_1.5fr_72px] items-center gap-4 px-5 py-4 transition-colors hover:bg-zinc-50/75 ${
                    i > 0 ? "border-t border-zinc-100" : ""
                  }`}
                >
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
                        className="w-full border-b border-zinc-300 bg-transparent text-sm font-medium text-zinc-900 outline-none"
                      />
                    ) : (
                      <p className={`text-sm font-medium ${wf.status === "draft" ? "text-zinc-400" : "text-zinc-900"}`}>
                        {wf.name}
                      </p>
                    )}

                    {wf.description && renamingId !== wf.id && (
                      <p className="mt-0.5 max-w-xs truncate text-xs text-zinc-400">{wf.description}</p>
                    )}
                  </div>

                  <div>
                    <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-semibold ${cfg.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>

                  <div>
                    <p className="text-sm text-zinc-700">{lastRun}</p>
                    <p className="mt-0.5 text-xs text-zinc-400">{wf.trigger_type}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {userMap[wf.created_by]?.imageUrl ? (
                      <img
                        src={userMap[wf.created_by].imageUrl}
                        alt={userMap[wf.created_by].name}
                        className="h-6 w-6 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600">
                        {(userMap[wf.created_by]?.name ?? wf.created_by).slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <span className="truncate text-sm text-zinc-700">
                      {userMap[wf.created_by]?.name ?? `${wf.created_by.slice(0, 8)}...`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(wf);
                      }}
                      className="rounded p-1.5 text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                      title="Rename"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteWorkflow(wf.id);
                      }}
                      className="rounded p-1.5 text-zinc-300 transition-colors hover:bg-red-50 hover:text-red-500"
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

      <div className="flex justify-end pt-5 pb-2">
        <button
          onClick={createWorkflow}
          disabled={creating}
          className="flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(24,24,27,0.28)] transition hover:bg-zinc-700 disabled:opacity-50"
        >
          <Plus size={15} />
          New Workflow
        </button>
      </div>
    </div>
  );
}
