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
  const isDelay = data.kind === "logic_delay";
  const isSetVariables = data.kind === "logic_set_variables";
  const duration = isDelay ? (data.inputs?.duration as string | undefined) : undefined;

  let setVariablesSummary: { name: string; value: string } | null = null;
  if (isSetVariables) {
    const inputs = data.inputs ?? {};
    const variableName = String(inputs.variable_name ?? "").trim();
    const mode = String(inputs.set_mode ?? "value") === "expression" ? "expression" : "value";
    const rawValue = mode === "expression" ? String(inputs.expression ?? "") : String(inputs.value ?? "");

    if (variableName || rawValue) {
      setVariablesSummary = {
        name: variableName || "variable",
        value: rawValue || "(empty)",
      };
    } else {
      try {
        const parsed = JSON.parse(String(inputs.variables_json ?? "")) as Record<string, unknown>;
        const firstEntry = Object.entries(parsed ?? {})[0];
        if (firstEntry) {
          setVariablesSummary = {
            name: firstEntry[0],
            value: String(firstEntry[1] ?? "(empty)"),
          };
        }
      } catch {
        // ignore invalid json for node preview
      }
    }
  }

  // Count rules in condition JSON for preview
  let conditionSummary: string | null = null;
  if (isCondition && data.inputs?.condition) {
    try {
      const parsed = JSON.parse(data.inputs.condition as string) as Record<string, unknown>;
      if ("and" in parsed) conditionSummary = `${(parsed.and as unknown[]).length} rules (AND)`;
      else if ("or" in parsed) conditionSummary = `${(parsed.or as unknown[]).length} rules (OR)`;
      else conditionSummary = "1 rule";
    } catch { /* ignore */ }
  }

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
      {isCondition && (
        <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
          <span className="text-amber-500 text-[12px] leading-none">⑂</span>
          <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
            {conditionSummary ?? <span className="font-normal text-amber-400/70">not configured</span>}
          </span>
        </div>
      )}
      {isDelay && (
        <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
          <span className="text-amber-500 text-[13px] leading-none">⏱</span>
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            {duration || <span className="font-normal text-amber-400/70">not set</span>}
          </span>
        </div>
      )}
      {isSetVariables && (
        <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
          <span className="text-amber-500 text-[12px] leading-none">#</span>
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 truncate">
            {setVariablesSummary ? (
              <>
                {setVariablesSummary.name} = {setVariablesSummary.value}
              </>
            ) : (
              <span className="font-normal text-amber-400/70">not configured</span>
            )}
          </span>
        </div>
      )}
      {isCondition ? (
        <>
          <div className="mt-3 flex justify-between items-stretch gap-2">
            <div className="flex-1 flex items-center justify-center gap-1 px-2 py-1">
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">True</span>
            </div>
            <div className="flex-1 flex items-center justify-center gap-1 px-2 py-1">
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">False</span>
            </div>
          </div>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="!bg-amber-400 !w-3 !h-3"
            style={{ left: "27%" }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="!bg-amber-400 !w-3 !h-3"
            style={{ left: "73%" }}
          />
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} className="!bg-amber-400 !w-3 !h-3" />
      )}
    </div>
  );
}
