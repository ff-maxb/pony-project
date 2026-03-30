"use client";

import { Handle, Position } from "@xyflow/react";

interface GmailNodeData {
  kind: string;
  name: string;
  inputs: Record<string, unknown>;
}

export default function GmailNode({
  data,
  selected,
}: {
  data: GmailNodeData;
  selected?: boolean;
}) {
  const actionLabel = data.kind === "gmail_send_email" ? "Send Email" : data.name;

  // Gmail brand color: #EA4335
  const brand = "#EA4335";

  return (
    <div
      style={selected ? { borderColor: brand, backgroundColor: "#fef2f2" } : {}}
      className={`px-4 py-3 rounded-xl border-2 min-w-[180px] shadow-sm transition-colors cursor-pointer ${
        selected
          ? "dark:bg-red-950"
          : "border-[#f5b5b0] dark:border-[#7a1f1a] bg-white dark:bg-zinc-900 hover:border-[#EA4335]"
      }`}
    >
      <Handle type="target" position={Position.Top} style={{ backgroundColor: brand }} className="!w-3 !h-3" />
      <div className="flex items-center gap-1.5">
        <img src="/integrations/gmail.svg" alt="Gmail" className="w-3.5 h-3.5 object-contain" />
        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">Gmail</p>
      </div>
      <p className="text-[10px] text-zinc-400 mt-0.5">{actionLabel}</p>
      <Handle type="source" position={Position.Bottom} style={{ backgroundColor: brand }} className="!w-3 !h-3" />
    </div>
  );
}
