"use client";

import { Handle, Position } from "@xyflow/react";

interface ActionNodeData {
  kind: string;
  name: string;
  inputs: Record<string, unknown>;
}

export default function ActionNode({
  data,
  selected,
}: {
  data: ActionNodeData;
  selected?: boolean;
}) {
  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 bg-white dark:bg-zinc-900 min-w-[180px] shadow-sm transition-colors cursor-pointer ${
        selected
          ? "border-zinc-900 dark:border-zinc-100"
          : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-zinc-400 !w-3 !h-3" />
      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{data.name}</p>
      <p className="text-[10px] text-zinc-400 mt-0.5">{data.kind}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-zinc-400 !w-3 !h-3" />
    </div>
  );
}
