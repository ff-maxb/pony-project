"use client";

import { Handle, Position } from "@xyflow/react";

interface SlackNodeData {
  kind: string;
  name: string;
  inputs: Record<string, unknown>;
}

export default function SlackNode({
  data,
  selected,
}: {
  data: SlackNodeData;
  selected?: boolean;
}) {
  const actionLabel = data.kind === "slack_send_message" ? "Send Message" : data.name;
  // Slack brand color
  const brand = "#4A154B";

  return (
    <div
      style={selected ? { borderColor: brand, backgroundColor: "#f7f0f7" } : {}}
      className={`px-4 py-3 rounded-xl border-2 min-w-[180px] shadow-sm transition-colors cursor-pointer ${
        selected
          ? "dark:bg-[#1a0a1a]"
          : "border-[#d9b8da] dark:border-[#5a1f5c] bg-white dark:bg-zinc-900 hover:border-[#4A154B]"
      }`}
    >
      <Handle type="target" position={Position.Top} style={{ backgroundColor: brand }} className="!w-3 !h-3" />
      <div className="flex items-center gap-1.5">
        <img src="/integrations/slack.svg" alt="Slack" className="w-3.5 h-3.5 object-contain" />
        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">Slack</p>
      </div>
      <p className="text-[10px] text-zinc-400 mt-0.5">{actionLabel}</p>
      <Handle type="source" position={Position.Bottom} style={{ backgroundColor: brand }} className="!w-3 !h-3" />
    </div>
  );
}
