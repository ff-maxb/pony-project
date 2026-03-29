"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

type Operator = "==" | "!=" | ">" | "<" | ">=" | "<=" | "contains" | "empty" | "not_empty";

interface Rule {
  id: string;
  field: string;
  operator: Operator;
  value: string;
}

interface RuleGroup {
  combinator: "and" | "or";
  rules: Rule[];
}

// ─── Operator config ──────────────────────────────────────────────────────────

const OPERATORS: { value: Operator; label: string; noValue?: boolean }[] = [
  { value: "==",        label: "equals" },
  { value: "!=",        label: "not equals" },
  { value: ">",         label: "greater than" },
  { value: "<",         label: "less than" },
  { value: ">=",        label: "≥" },
  { value: "<=",        label: "≤" },
  { value: "contains",  label: "contains" },
  { value: "empty",     label: "is empty",     noValue: true },
  { value: "not_empty", label: "is not empty", noValue: true },
];

// ─── Serialization ────────────────────────────────────────────────────────────

function typedValue(raw: string): unknown {
  if (raw === "true")  return true;
  if (raw === "false") return false;
  const n = Number(raw);
  if (raw !== "" && !isNaN(n)) return n;
  return raw;
}

function ruleToLogic(rule: Rule): unknown {
  const ref = `!ref($.${rule.field})`;
  if (rule.operator === "empty")     return { "==": [ref, ""] };
  if (rule.operator === "not_empty") return { "!=": [ref, ""] };
  if (rule.operator === "contains")  return { "in": [typedValue(rule.value), ref] };
  return { [rule.operator]: [ref, typedValue(rule.value)] };
}

function groupToJson(group: RuleGroup): string {
  if (group.rules.length === 0) return "";
  const logics = group.rules.map(ruleToLogic);
  const logic = logics.length === 1 ? logics[0] : { [group.combinator]: logics };
  return JSON.stringify(logic);
}

// ─── Deserialization ──────────────────────────────────────────────────────────

let _counter = Date.now();
function uid() { return String(_counter++); }

function extractRef(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.match(/^!ref\(\$\.(.+)\)$/);
  return m ? m[1] : null;
}

function parseRule(obj: unknown): Rule | null {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const rec = obj as Record<string, unknown>;

  for (const op of ["==", "!=", ">", "<", ">=", "<="] as const) {
    if (!(op in rec)) continue;
    const [a, b] = rec[op] as [unknown, unknown];
    const ref = extractRef(a);
    if (!ref) continue;
    if (op === "==" && (b === "" || b === null)) return { id: uid(), field: ref, operator: "empty", value: "" };
    if (op === "!=" && (b === "" || b === null)) return { id: uid(), field: ref, operator: "not_empty", value: "" };
    return { id: uid(), field: ref, operator: op, value: String(b ?? "") };
  }

  if ("in" in rec) {
    const [a, b] = rec["in"] as [unknown, unknown];
    const ref = extractRef(b);
    if (ref) return { id: uid(), field: ref, operator: "contains", value: String(a ?? "") };
  }

  return null;
}

function jsonToGroup(json: string): RuleGroup | null {
  if (!json.trim()) return null;
  let obj: unknown;
  try { obj = JSON.parse(json); } catch { return null; }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const rec = obj as Record<string, unknown>;

  for (const comb of ["and", "or"] as const) {
    if (!(comb in rec)) continue;
    const arr = rec[comb] as unknown[];
    const rules = arr.map(parseRule).filter((r): r is Rule => r !== null);
    if (rules.length > 0) return { combinator: comb, rules };
  }

  const single = parseRule(obj);
  if (single) return { combinator: "and", rules: [single] };
  return null;
}

function emptyRule(): Rule {
  return { id: uid(), field: "event.data.", operator: "==", value: "" };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ConditionPanelProps {
  value: string;
  onChange: (value: string) => void;
}

export default function ConditionPanel({ value, onChange }: ConditionPanelProps) {
  const [group, setGroup] = useState<RuleGroup>(
    () => jsonToGroup(value) ?? { combinator: "and", rules: [emptyRule()] }
  );
  const [showRaw, setShowRaw] = useState(false);

  // Sync when parent resets value (e.g. node switch)
  useEffect(() => {
    const parsed = jsonToGroup(value);
    if (parsed) setGroup(parsed);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = useCallback(
    (g: RuleGroup) => {
      const json = groupToJson(g);
      if (json) onChange(json);
    },
    [onChange]
  );

  function updateRule(id: string, patch: Partial<Rule>) {
    setGroup((g) => {
      const next = { ...g, rules: g.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) };
      emit(next);
      return next;
    });
  }

  function addRule() {
    setGroup((g) => {
      const next = { ...g, rules: [...g.rules, emptyRule()] };
      emit(next);
      return next;
    });
  }

  function removeRule(id: string) {
    setGroup((g) => {
      const rules = g.rules.filter((r) => r.id !== id);
      if (rules.length === 0) rules.push(emptyRule());
      const next = { ...g, rules };
      emit(next);
      return next;
    });
  }

  function setCombinator(c: "and" | "or") {
    setGroup((g) => {
      const next = { ...g, combinator: c };
      emit(next);
      return next;
    });
  }

  const preview = groupToJson(group);

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Conditions</p>
        <button
          onClick={() => setShowRaw((v) => !v)}
          className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        >
          {showRaw ? "← Visual" : "Raw JSON →"}
        </button>
      </div>

      {showRaw ? (
        <textarea
          value={preview}
          onChange={(e) => {
            onChange(e.target.value);
            const parsed = jsonToGroup(e.target.value);
            if (parsed) setGroup(parsed);
          }}
          rows={7}
          className="w-full text-[11px] font-mono border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 resize-none focus:outline-none focus:ring-1 focus:ring-zinc-400"
          placeholder={'e.g. {"==": ["!ref($.event.data.status)", "active"]}'}
        />
      ) : (
        <>
          {/* AND / OR toggle — only when multiple rules */}
          {group.rules.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-400">Match</span>
              {(["and", "or"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCombinator(c)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-colors ${
                    group.combinator === c
                      ? "bg-amber-100 dark:bg-amber-900/60 border-amber-400 text-amber-700 dark:text-amber-300"
                      : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400 dark:hover:border-zinc-500"
                  }`}
                >
                  {c.toUpperCase()}
                </button>
              ))}
              <span className="text-[10px] text-zinc-400">rules</span>
            </div>
          )}

          {/* Rule rows */}
          <div className="space-y-2">
            {group.rules.map((rule, idx) => {
              const opDef = OPERATORS.find((o) => o.value === rule.operator);
              return (
                <div
                  key={rule.id}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-2.5 space-y-2"
                >
                  {/* Rule label + remove */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">
                      {group.rules.length > 1
                        ? idx === 0
                          ? "IF"
                          : group.combinator.toUpperCase()
                        : "IF"}
                    </span>
                    <button
                      onClick={() => removeRule(rule.id)}
                      className="text-zinc-300 dark:text-zinc-600 hover:text-red-400 dark:hover:text-red-500 text-sm leading-none transition-colors"
                    >
                      ×
                    </button>
                  </div>

                  {/* Field path */}
                  <div>
                    <p className="text-[10px] text-zinc-400 mb-1">Field path</p>
                    <Input
                      value={rule.field}
                      onChange={(e) => updateRule(rule.id, { field: e.target.value })}
                      placeholder="event.data.status"
                      className="text-xs h-7"
                    />
                  </div>

                  {/* Operator + Value */}
                  <div className="flex gap-1.5 items-center">
                    <Select
                      value={rule.operator}
                      onValueChange={(v) => v && updateRule(rule.id, { operator: v as Operator })}
                    >
                      <SelectTrigger className="w-[108px] text-xs h-7 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((op) => (
                          <SelectItem key={op.value} value={op.value} className="text-xs">
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!opDef?.noValue && (
                      <Input
                        value={rule.value}
                        onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                        placeholder="value"
                        className="text-xs h-7 flex-1 min-w-0"
                      />
                    )}
                  </div>

                  {/* Field path helper */}
                  {rule.field && (
                    <p className="text-[9px] text-zinc-400 font-mono leading-tight break-all">
                      !ref($.{rule.field})
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add condition button */}
          <button
            onClick={addRule}
            className="w-full flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          >
            <span className="text-base leading-none">+</span>
            Add condition
          </button>

          {/* JSON Logic preview */}
          {preview && (
            <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-2.5 py-2">
              <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                JSON Logic preview
              </p>
              <pre className="text-[10px] text-zinc-500 dark:text-zinc-400 whitespace-pre-wrap break-all leading-relaxed">
                {JSON.stringify(JSON.parse(preview), null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
