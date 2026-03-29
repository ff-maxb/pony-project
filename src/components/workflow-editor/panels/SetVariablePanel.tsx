"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SetVariablePanelProps {
  variableName: string;
  mode: "value" | "expression";
  inputValue: string;
  suggestions: string[];
  onChange: (next: { variableName: string; mode: "value" | "expression"; inputValue: string }) => void;
}

export default function SetVariablePanel({
  variableName,
  mode,
  inputValue,
  suggestions,
  onChange,
}: SetVariablePanelProps) {
  const placeholder =
    mode === "expression" ? "Enter expression e.g. event.data.email" : "Enter value or {var}";
  const currentVariableName = variableName.trim() || "variable";

  const summaryValue = inputValue.trim()
    ? mode === "expression"
      ? inputValue.trim()
      : `"${inputValue.trim()}"`
    : "(empty)";
  const variableOptions = Array.from(new Set([...suggestions, variableName.trim()].filter(Boolean)));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Variable</p>
        <p className="text-[10px] text-zinc-400 mb-2">Choose a variable name to set for downstream steps</p>
        <Select
          value={variableName || undefined}
          onValueChange={(v) => onChange({ variableName: v ?? "", mode, inputValue })}
        >
          <SelectTrigger className="w-full text-sm">
            <SelectValue placeholder="Select variable" />
          </SelectTrigger>
          <SelectContent>
            {variableOptions.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">Set to</p>
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => onChange({ variableName, mode: "value", inputValue })}
            className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200"
          >
            <span
              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                mode === "value"
                  ? "border-amber-500"
                  : "border-zinc-300 dark:border-zinc-600"
              }`}
            >
              {mode === "value" ? <span className="w-2 h-2 rounded-full bg-amber-500" /> : null}
            </span>
            Value
          </button>
          <button
            type="button"
            onClick={() => onChange({ variableName, mode: "expression", inputValue })}
            className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200"
          >
            <span
              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                mode === "expression"
                  ? "border-amber-500"
                  : "border-zinc-300 dark:border-zinc-600"
              }`}
            >
              {mode === "expression" ? <span className="w-2 h-2 rounded-full bg-amber-500" /> : null}
            </span>
            Expression
          </button>
        </div>
      </div>

      {mode === "expression" ? (
        <div className="flex gap-2">
          <Input
            type="text"
            value={inputValue}
            onChange={(e) => onChange({ variableName, mode, inputValue: e.target.value })}
            className="flex-1 text-sm"
            placeholder={placeholder}
          />
          <Select
            value="none"
            onValueChange={(v) => {
              if (v === "none") return;
              const nextValue = inputValue.trim() ? `${inputValue}{{${v}}}` : `{{${v}}}`;
              onChange({ variableName, mode, inputValue: nextValue });
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Insert" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Insert</SelectItem>
              <SelectItem value="event.data">event.data</SelectItem>
              <SelectItem value="vars">vars</SelectItem>
              <SelectItem value="steps">steps</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : (
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => onChange({ variableName, mode, inputValue: e.target.value })}
          className="w-full text-sm"
          placeholder={placeholder}
        />
      )}

      <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
        Set <span className="font-semibold">{currentVariableName}</span> to <span className="font-semibold">{summaryValue}</span>
      </p>
    </div>
  );
}
