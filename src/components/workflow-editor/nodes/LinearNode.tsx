"use client";

import { Handle, Position } from "@xyflow/react";

interface LinearNodeData {
  kind: string;
  name: string;
  inputs: Record<string, unknown>;
}

export default function LinearNode({
  data,
  selected,
}: {
  data: LinearNodeData;
  selected?: boolean;
}) {
  const actionLabel = data.kind === "linear_update_issue" ? "Update Issue" : "Create Issue";

  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 min-w-[180px] shadow-sm transition-colors cursor-pointer ${
        selected
          ? "border-violet-600 dark:border-violet-400 bg-violet-50 dark:bg-violet-950"
          : "border-violet-200 dark:border-violet-800 bg-white dark:bg-zinc-900 hover:border-violet-400 dark:hover:border-violet-600"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-violet-400 !w-3 !h-3" />
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-bold text-violet-500">◈</span>
        <p className="text-xs font-semibold text-violet-800 dark:text-violet-200">Linear</p>
      </div>
      <p className="text-[10px] text-violet-400 mt-0.5">{actionLabel}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-violet-400 !w-3 !h-3" />
    </div>
  );
}
