"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const UNITS = [
  { value: "s", label: "Seconds" },
  { value: "m", label: "Minutes" },
  { value: "h", label: "Hours" },
  { value: "d", label: "Days" },
];

const PRESETS = ["30s", "1m", "5m", "15m", "30m", "1h", "6h", "12h", "1d"];

function parseDuration(raw: string): { amount: string; unit: string } {
  const match = raw.match(/^(\d+(?:\.\d+)?)(s|m|h|d)$/);
  if (match) return { amount: match[1], unit: match[2] };
  return { amount: "5", unit: "m" };
}

function buildDuration(amount: string, unit: string): string {
  const n = parseFloat(amount);
  if (!amount || isNaN(n) || n <= 0) return "";
  return `${n}${unit}`;
}

interface DelayPanelProps {
  value: string;
  onChange: (value: string) => void;
}

export default function DelayPanel({ value, onChange }: DelayPanelProps) {
  const parsed = parseDuration(value || "5m");
  const [amount, setAmount] = useState(parsed.amount);
  const [unit, setUnit] = useState(parsed.unit);

  // Keep local state in sync if parent value changes (e.g. node switch)
  useEffect(() => {
    const p = parseDuration(value || "5m");
    setAmount(p.amount);
    setUnit(p.unit);
  }, [value]);

  function handleAmountChange(raw: string) {
    setAmount(raw);
    const built = buildDuration(raw, unit);
    if (built) onChange(built);
  }

  function handleUnitChange(newUnit: string) {
    setUnit(newUnit);
    const built = buildDuration(amount, newUnit);
    if (built) onChange(built);
  }

  function handlePreset(preset: string) {
    const { amount: a, unit: u } = parseDuration(preset);
    setAmount(a);
    setUnit(u);
    onChange(preset);
  }

  const currentDuration = buildDuration(amount, unit);
  const unitLabel = UNITS.find((u) => u.value === unit)?.label.toLowerCase() ?? unit;

  return (
    <div className="space-y-4">
      {/* Label */}
      <div>
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Duration</p>
        <p className="text-[10px] text-zinc-400">How long to wait before continuing</p>
      </div>

      {/* Number + Unit row */}
      <div className="flex gap-2">
        <Input
          type="number"
          min="1"
          step="1"
          value={amount}
          onChange={(e) => handleAmountChange(e.target.value)}
          className="w-24 text-sm"
          placeholder="5"
        />
        <Select value={unit} onValueChange={(v) => v && handleUnitChange(v)}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNITS.map((u) => (
              <SelectItem key={u.value} value={u.value}>
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      {currentDuration && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
          ⏱ Wait <span className="font-semibold">{amount} {unitLabel}</span> before continuing
        </p>
      )}

      {/* Quick presets */}
      <div>
        <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide mb-2">Quick presets</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => handlePreset(preset)}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                currentDuration === preset
                  ? "bg-amber-100 dark:bg-amber-900/60 border-amber-400 text-amber-700 dark:text-amber-300"
                  : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-amber-300 hover:text-amber-600"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
