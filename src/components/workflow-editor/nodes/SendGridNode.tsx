"use client";

import { Handle, Position } from "@xyflow/react";
import { Mail } from "lucide-react";

interface SendGridNodeData {
  kind: string;
  name: string;
  inputs: Record<string, unknown>;
}

export default function SendGridNode({
  data,
  selected,
}: {
  data: SendGridNodeData;
  selected?: boolean;
}) {
  const actionLabel = data.kind === "sendgrid_send_email" ? "Send Email" : data.name;

  const accent = "#71717a"; // zinc-500

  return (
    <div
      style={selected ? { borderColor: "#3f3f46", backgroundColor: "#fafafa" } : {}}
      className={`px-4 py-3 rounded-xl border-2 min-w-[180px] shadow-sm transition-colors cursor-pointer ${
        selected
          ? "dark:bg-zinc-800"
          : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-400"
      }`}
    >
      <Handle type="target" position={Position.Top} style={{ backgroundColor: accent }} className="!w-3 !h-3" />
      <div className="flex items-center gap-1.5">
        <Mail className="w-3.5 h-3.5 text-zinc-500" />
        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">Email</p>
      </div>
      <p className="text-[10px] text-zinc-400 mt-0.5">{actionLabel}</p>
      <Handle type="source" position={Position.Bottom} style={{ backgroundColor: accent }} className="!w-3 !h-3" />
    </div>
  );
}
