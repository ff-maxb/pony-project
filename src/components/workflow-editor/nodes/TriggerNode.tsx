"use client";

import { Handle, Position } from "@xyflow/react";

export default function TriggerNode({ selected }: { selected?: boolean }) {
  return (
    <div
      className={`px-5 py-3 rounded-xl border-2 min-w-[160px] text-center shadow-sm transition-colors ${
        selected
          ? "border-indigo-600 dark:border-indigo-300 bg-indigo-100 dark:bg-indigo-900"
          : "border-indigo-400 bg-indigo-50 dark:bg-indigo-950 dark:border-indigo-500"
      }`}
    >
      <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-300 uppercase tracking-wide">
        Trigger
      </p>
      <p className="text-[10px] text-indigo-400 mt-0.5">Workflow start</p>
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-400 !w-3 !h-3" />
    </div>
  );
}
