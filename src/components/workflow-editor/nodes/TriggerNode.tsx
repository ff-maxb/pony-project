"use client";

import { Handle, Position } from "@xyflow/react";
import { Play, Webhook, Clock } from "lucide-react";

const TRIGGER_META: Record<string, { label: string; subLabel: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  manual: { label: "Manual / API", subLabel: "Trigger manually or via API", icon: Play },
  webhook: { label: "Webhook", subLabel: "Incoming HTTP request", icon: Webhook },
  cron: { label: "Schedule", subLabel: "Runs on a cron schedule", icon: Clock },
};

export default function TriggerNode({ selected, data }: { selected?: boolean; data?: Record<string, unknown> }) {
  const triggerType = (data?.triggerType as string) || "manual";
  const meta = TRIGGER_META[triggerType] ?? TRIGGER_META.manual;
  const Icon = meta.icon;

  return (
    <div
      className={`px-5 py-3 rounded-xl border-2 min-w-[160px] text-center shadow-sm transition-colors ${
        selected
          ? "border-indigo-600 dark:border-indigo-300 bg-indigo-100 dark:bg-indigo-900"
          : "border-indigo-400 bg-indigo-50 dark:bg-indigo-950 dark:border-indigo-500"
      }`}
    >
      <div className="flex items-center justify-center gap-1.5 mb-0.5">
        <Icon size={12} className="text-indigo-500 dark:text-indigo-400" />
        <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-300 uppercase tracking-wide">
          Trigger
        </p>
      </div>
      <p className="text-[10px] text-indigo-400 mt-0.5">{meta.label}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-400 !w-3 !h-3" />
    </div>
  );
}
