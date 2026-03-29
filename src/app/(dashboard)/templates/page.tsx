"use client";

import { useRouter } from "next/navigation";
import { useTeam } from "@/hooks/useTeam";
import { useState } from "react";

type Category = "All" | "Messaging" | "AI" | "Data" | "DevOps" | "CRM";

const CATEGORIES: Category[] = ["All", "Messaging", "AI", "Data", "DevOps", "CRM"];

interface Template {
  name: string;
  description: string;
  icons: string[];
  category: Exclude<Category, "All">;
  triggerType: "webhook" | "cron" | "manual" | "event";
}

const TEMPLATES: Template[] = [
  {
    name: "Slack to Discord Sync",
    description: "Cross-platform messaging bridge with thread support and file attachments.",
    icons: ["💬", "→", "🎮"],
    category: "Messaging",
    triggerType: "event",
  },
  {
    name: "AI Email Support",
    description: "Automatically categorize and draft responses to customer inquiries using LLMs.",
    icons: ["✉️", "⚡", "🤖"],
    category: "AI",
    triggerType: "webhook",
  },
  {
    name: "DB to Dashboard",
    description: "Real-time sync between production databases and analytical BI tools.",
    icons: ["🗄️", "〜", "📊"],
    category: "Data",
    triggerType: "cron",
  },
  {
    name: "GitHub PR Notifier",
    description: "Post a Slack message whenever a pull request is opened or merged.",
    icons: ["🐙", "→", "💬"],
    category: "DevOps",
    triggerType: "webhook",
  },
  {
    name: "Lead Enrichment",
    description: "Enrich new CRM leads with company data and assign to the right rep automatically.",
    icons: ["📋", "⚡", "🏢"],
    category: "CRM",
    triggerType: "event",
  },
  {
    name: "Daily Digest Email",
    description: "Send a summary email every morning with key metrics from your data sources.",
    icons: ["☀️", "📊", "✉️"],
    category: "Data",
    triggerType: "cron",
  },
  {
    name: "AI Content Moderation",
    description: "Automatically flag and review user-generated content with an LLM-based pipeline.",
    icons: ["🛡️", "🤖", "✅"],
    category: "AI",
    triggerType: "webhook",
  },
  {
    name: "On-call Alert Escalation",
    description: "Escalate unacknowledged alerts to the next on-call engineer after a timeout.",
    icons: ["🚨", "⏱️", "📱"],
    category: "DevOps",
    triggerType: "event",
  },
  {
    name: "New User Onboarding",
    description: "Send a welcome email series and provision resources when a user signs up.",
    icons: ["👋", "✉️", "🔧"],
    category: "Messaging",
    triggerType: "event",
  },
];

const TRIGGER_LABELS: Record<string, string> = {
  webhook: "Webhook",
  cron: "Scheduled",
  manual: "Manual",
  event: "Event",
};

const TRIGGER_COLORS: Record<string, string> = {
  webhook: "bg-blue-50 text-blue-700 border-blue-200",
  cron: "bg-amber-50 text-amber-700 border-amber-200",
  manual: "bg-zinc-50 text-zinc-600 border-zinc-200",
  event: "bg-violet-50 text-violet-700 border-violet-200",
};

export default function TemplatesPage() {
  const router = useRouter();
  const { activeTeam } = useTeam();
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [creating, setCreating] = useState<string | null>(null);

  const filtered =
    activeCategory === "All"
      ? TEMPLATES
      : TEMPLATES.filter((t) => t.category === activeCategory);

  async function useTemplate(template: Template) {
    if (!activeTeam) return;
    setCreating(template.name);
    const res = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId: activeTeam.id,
        name: template.name,
        trigger_type: template.triggerType,
      }),
    });
    if (res.ok) {
      const wf = await res.json();
      router.push(`/workflows/${wf.id}/edit`);
    }
    setCreating(null);
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Templates</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Start from a pre-built workflow and customise it to your needs.
        </p>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
              activeCategory === cat
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:text-zinc-900"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-4">
        {filtered.map((t) => (
          <div
            key={t.name}
            className="bg-white border border-zinc-200 rounded-xl p-5 hover:border-zinc-300 hover:shadow-sm transition-all flex flex-col"
          >
            {/* Icons row */}
            <div className="flex items-center gap-1.5 text-xl mb-3">
              {t.icons.map((icon, i) => (
                <span key={i} className={i === 1 ? "text-sm text-zinc-400" : ""}>{icon}</span>
              ))}
            </div>

            {/* Name + badge */}
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <h3 className="text-sm font-semibold text-zinc-900 leading-snug">{t.name}</h3>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${TRIGGER_COLORS[t.triggerType]}`}>
                {TRIGGER_LABELS[t.triggerType]}
              </span>
            </div>

            <p className="text-xs text-zinc-500 leading-relaxed flex-1 mb-4">{t.description}</p>

            <button
              onClick={() => useTemplate(t)}
              disabled={creating === t.name}
              className="w-full py-1.5 rounded-lg text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              {creating === t.name ? "Creating…" : "Use Template"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
