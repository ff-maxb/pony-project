"use client";

import { Handle, Position } from "@xyflow/react";

interface LogicNodeData {
  kind: string;
  name: string;
  inputs: Record<string, unknown>;
}

export default function LogicNode({
  data,
  selected,
}: {
  data: LogicNodeData;
  selected?: boolean;
}) {
  const isCondition = data.kind === "builtin:if";

  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 bg-white dark:bg-zinc-900 min-w-[180px] shadow-sm transition-colors cursor-pointer ${
        selected
          ? "border-amber-500 dark:border-amber-400"
          : "border-amber-300 dark:border-amber-700 hover:border-amber-400 dark:hover:border-amber-500"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-amber-400 !w-3 !h-3" />
      <p className="text-[9px] font-semibold text-amber-500 uppercase tracking-wide mb-0.5">
        Logic
      </p>
      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{data.name}</p>
      {isCondition ? (
        <div className="relative mt-3 flex justify-between items-end text-[9px] pb-1">
          <span className="text-emerald-500 font-medium">True</span>
          <span className="text-red-400 font-medium">False</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="!bg-emerald-500 !w-3 !h-3"
            style={{ left: "28%" }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="!bg-red-400 !w-3 !h-3"
            style={{ left: "72%" }}
          />
        </div>
      ) : (
        <Handle type="source" position={Position.Bottom} className="!bg-amber-400 !w-3 !h-3" />
      )}
    </div>
  );
}
