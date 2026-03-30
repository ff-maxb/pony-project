"use client";

import { Handle, Position } from "@xyflow/react";

interface CalendlyNodeData {
  kind: string;
  name: string;
  inputs: Record<string, unknown>;
}

export default function CalendlyNode({
  data,
  selected,
}: {
  data: CalendlyNodeData;
  selected?: boolean;
}) {
  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 min-w-[180px] shadow-sm transition-colors cursor-pointer ${
        selected
          ? "border-[#006BFF] dark:border-[#4A90FF] bg-[#EAF2FF] dark:bg-[#0C2147]"
          : "border-[#B8D3FF] dark:border-[#2452A3] bg-white dark:bg-zinc-900 hover:border-[#4A90FF] dark:hover:border-[#4A90FF]"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-[#4A90FF] !w-3 !h-3" />
      <div className="flex items-center gap-1.5">
        <img src="/integrations/calendly.svg" alt="Calendly" className="w-3.5 h-3.5 object-contain" />
        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">Calendly</p>
      </div>
      <p className="text-[10px] text-zinc-400 mt-0.5">Create Scheduling Link</p>
      <Handle type="source" position={Position.Bottom} className="!bg-[#4A90FF] !w-3 !h-3" />
    </div>
  );
}
