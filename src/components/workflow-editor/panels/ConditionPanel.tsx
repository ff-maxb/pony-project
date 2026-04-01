"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
  { value: "==",        label: "is" },
  { value: "!=",        label: "is not" },
  { value: ">",         label: "greater than" },
  { value: ">=",        label: "greater or equal" },
  { value: "<",         label: "less than" },
  { value: "<=",        label: "less or equal" },
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
  return { id: uid(), field: "", operator: "==", value: "" };
}

// ─── FieldChip ────────────────────────────────────────────────────────────────

interface FieldChipProps {
  ruleId: string;
  field: string;
  variables: string[];
  hasAddVariable: boolean;
  openVarPicker: string | null;
  setOpenVarPicker: (id: string | null) => void;
  onFieldChange: (id: string, field: string) => void;
  onPickCreate: (ruleId: string) => void;
}

function FieldChip({
  ruleId,
  field,
  variables,
  hasAddVariable,
  openVarPicker,
  setOpenVarPicker,
  onFieldChange,
  onPickCreate,
}: FieldChipProps) {
  const isVar = field.startsWith("vars.");
  const varName = isVar ? field.slice(5) : null;
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const isOpen = openVarPicker === ruleId;

  function openPicker() {
    setSearch("");
    setOpenVarPicker(ruleId);
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  const filtered = variables.filter((v) =>
    v.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative shrink-0" onMouseDown={(e) => e.stopPropagation()}>
      {isVar ? (
        <button
          type="button"
          onClick={openPicker}
          className="inline-flex items-center h-7 text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors max-w-[150px] truncate"
          title={field}
        >
          <span className="opacity-60">{"{ "}</span>
          <span className="truncate">{varName}</span>
          <span className="opacity-60">{" }"}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          className="inline-flex items-center h-7 px-2 rounded-md border border-dashed border-zinc-300 dark:border-zinc-600 text-xs text-zinc-400 hover:border-amber-400 hover:text-amber-600 transition-colors min-w-[80px]"
        >
          {field || "Select variable…"}
        </button>
      )}

      {isOpen && (
        <div className="absolute left-0 top-8 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl w-56">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
            <svg className="w-3.5 h-3.5 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="flex-1 text-xs bg-transparent focus:outline-none text-zinc-700 dark:text-zinc-200 placeholder-zinc-400"
              onKeyDown={(e) => { if (e.key === "Escape") setOpenVarPicker(null); }}
            />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="text-[11px] text-zinc-400 text-center py-3">No variables found</p>
            )}
            {filtered.map((v) => (
              <button
                key={v}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onFieldChange(ruleId, `vars.${v}`);
                  setOpenVarPicker(null);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${
                  varName === v ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300" : "text-zinc-700 dark:text-zinc-200"
                }`}
              >
                <span>{v}</span>
                {varName === v && (
                  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                )}
              </button>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ConditionPanelProps {
  value: string;
  onChange: (value: string) => void;
  variables?: string[];
  onAddVariable?: (name: string) => void;
}

export default function ConditionPanel({ value, onChange, variables = [], onAddVariable }: ConditionPanelProps) {
  const [group, setGroup] = useState<RuleGroup>(
    () => jsonToGroup(value) ?? { combinator: "and", rules: [emptyRule()] }
  );
  const [openVarPicker, setOpenVarPicker] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalInput, setCreateModalInput] = useState("");
  const [pendingRuleId, setPendingRuleId] = useState<string | null>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  const skipEmitRef = useRef(true);
  const lastEmittedRef = useRef<string>(value);

  // Sync when parent resets value (e.g. node switch) — but ignore echoes of our own emissions
  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    const parsed = jsonToGroup(value);
    if (parsed) {
      skipEmitRef.current = true;
      setGroup(parsed);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  // Emit to parent after every group change
  useEffect(() => {
    if (skipEmitRef.current) {
      skipEmitRef.current = false;
      return;
    }
    const json = groupToJson(group);
    if (json) {
      lastEmittedRef.current = json;
      onChangeRef.current(json);
    }
  }, [group]);

  // Close var picker on outside click
  useEffect(() => {
    if (!openVarPicker) return;
    function handleClick() { setOpenVarPicker(null); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openVarPicker]);

  function updateRule(id: string, patch: Partial<Rule>) {
    setGroup((g) => ({ ...g, rules: g.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  }

  function addRule() {
    setGroup((g) => ({ ...g, rules: [...g.rules, emptyRule()] }));
  }

  function removeRule(id: string) {
    setGroup((g) => {
      const rules = g.rules.filter((r) => r.id !== id);
      if (rules.length === 0) rules.push(emptyRule());
      return { ...g, rules };
    });
  }

  function openCreateModal(ruleId: string) {
    setPendingRuleId(ruleId);
    setCreateModalInput("");
    setCreateModalOpen(true);
    setTimeout(() => createInputRef.current?.focus(), 50);
  }

  function confirmCreate() {
    const name = createModalInput.trim();
    if (!name) return;
    onAddVariable!(name);
    if (pendingRuleId) updateRule(pendingRuleId, { field: `vars.${name}` });
    setCreateModalOpen(false);
  }

  return (
    <div className="space-y-3">
      {/* Header: Match all/any toggle + add button */}
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 p-0.5 gap-0.5 flex-1">
          {(["and", "or"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setGroup((g) => ({ ...g, combinator: c }))}
              className={`flex-1 py-1 rounded-md text-xs font-medium transition-all ${
                group.combinator === c
                  ? "bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {c === "and" ? "Match all" : "Match any"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={addRule}
          className="w-6 h-6 flex items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400 text-base leading-none transition-colors shrink-0"
          title="Add condition"
        >
          +
        </button>
      </div>

      {/* Rule rows */}
      <div className="space-y-2">
        {group.rules.map((rule) => {
          const opDef = OPERATORS.find((o) => o.value === rule.operator);
          return (
            <div key={rule.id} className="flex items-center flex-wrap gap-2 min-h-[28px]">
              {/* Field + variable picker */}
              <FieldChip
                ruleId={rule.id}
                field={rule.field}
                variables={variables}
                hasAddVariable={!!onAddVariable}
                openVarPicker={openVarPicker}
                setOpenVarPicker={setOpenVarPicker}
                onFieldChange={(id, field) => updateRule(id, { field })}
                onPickCreate={openCreateModal}
              />

              {/* Operator */}
              <Select
                value={rule.operator}
                onValueChange={(v) => v && updateRule(rule.id, { operator: v as Operator })}
              >
                <SelectTrigger className="w-auto min-w-[60px] max-w-[130px] text-xs h-7 shrink-0 border-0 bg-transparent text-blue-600 dark:text-blue-400 font-medium px-0 focus:ring-0 focus:ring-offset-0 shadow-none [&>svg]:ml-0.5">
                  <span>{OPERATORS.find((o) => o.value === rule.operator)?.label ?? rule.operator}</span>
                </SelectTrigger>
                <SelectContent>
                  {OPERATORS.map((op) => (
                    <SelectItem key={op.value} value={op.value} className="text-xs">
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Value */}
              {!opDef?.noValue && (
                <input
                  value={rule.value}
                  onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                  placeholder="value"
                  className="flex-1 basis-20 min-w-0 text-xs h-7 bg-transparent border-0 border-b border-dashed border-zinc-300 dark:border-zinc-600 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 text-zinc-700 dark:text-zinc-200 placeholder-zinc-400"
                />
              )}

              {/* Remove */}
              <button
                type="button"
                onClick={() => removeRule(rule.id)}
                className="ml-auto shrink-0 w-5 h-5 flex items-center justify-center text-zinc-300 dark:text-zinc-600 hover:text-red-400 dark:hover:text-red-500 transition-colors rounded text-base leading-none"
              >
                −
              </button>
            </div>
          );
        })}
      </div>

      {/* Create variable modal */}
      {createModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) setCreateModalOpen(false); }}
        >
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-5 w-80 flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Create variable</h3>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">Variable name</label>
              <Input
                ref={createInputRef}
                value={createModalInput}
                onChange={(e) => setCreateModalInput(e.target.value)}
                placeholder="my_variable"
                className="text-sm h-8"
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmCreate();
                  else if (e.key === "Escape") setCreateModalOpen(false);
                }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!createModalInput.trim()}
                onClick={confirmCreate}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Create variable
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
