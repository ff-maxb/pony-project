"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ChevronDown, ArrowRight } from "lucide-react";

interface SetVariablePanelProps {
  variableName: string;
  mode: "value" | "expression";
  inputValue: string;
  suggestions: string[];
  onChange: (next: { variableName: string; mode: "value" | "expression"; inputValue: string }) => void;
  onAddVariable?: (name: string, description?: string) => void;
}

export default function SetVariablePanel({
  variableName,
  mode,
  inputValue,
  suggestions,
  onChange,
  onAddVariable,
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

  // Dropdown state
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [newVarInput, setNewVarInput] = useState("");
  const [newVarDescription, setNewVarDescription] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 10);
  }, [open]);

  useEffect(() => {
    if (modalOpen) setTimeout(() => modalInputRef.current?.focus(), 10);
  }, [modalOpen]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const filtered = variableOptions.filter((v) =>
    v.toLowerCase().includes(search.toLowerCase())
  );

  function selectVariable(name: string) {
    onChange({ variableName: name, mode, inputValue });
    setOpen(false);
    setSearch("");
  }

  function commitNewVar() {
    const name = newVarInput.trim().replace(/\s+/g, "_");
    if (!name) return;
    const desc = newVarDescription.trim() || undefined;
    if (onAddVariable) onAddVariable(name, desc);
    onChange({ variableName: name, mode, inputValue });
    setNewVarInput("");
    setNewVarDescription("");
    setModalOpen(false);
  }

  return (
    <>
      {/* Create variable modal */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setModalOpen(false); setNewVarInput(""); }} />
          <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Create variable</h2>
              <button
                type="button"
                onClick={() => { setModalOpen(false); setNewVarInput(""); }}
                className="text-zinc-400 hover:text-zinc-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5 space-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Name
                  <span className="text-xs font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{"{}"}</span>
                </label>
                <input
                  ref={modalInputRef}
                  type="text"
                  value={newVarInput}
                  onChange={(e) => setNewVarInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); commitNewVar(); }
                    if (e.key === "Escape") { setModalOpen(false); setNewVarInput(""); }
                  }}
                  placeholder="Enter variable name"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Description <span className="text-zinc-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={newVarDescription}
                  onChange={(e) => setNewVarDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); commitNewVar(); }
                    if (e.key === "Escape") { setModalOpen(false); setNewVarInput(""); setNewVarDescription(""); }
                  }}
                  placeholder="Enter description (optional)"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => { setModalOpen(false); setNewVarInput(""); setNewVarDescription(""); }}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={commitNewVar}
                disabled={!newVarInput.trim()}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                Create variable
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-3">Variable</p>

        {/* Custom dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => { setOpen((o) => !o); setSearch(""); }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors bg-white dark:bg-zinc-900 ${
              open
                ? "border-blue-500 ring-1 ring-blue-500"
                : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"
            }`}
          >
            <ArrowRight size={14} className="text-zinc-400 shrink-0" />
            <span className={`flex-1 text-left truncate ${variableName ? "text-zinc-800 dark:text-zinc-100" : "text-zinc-400"}`}>
              {variableName || "Select variable to set"}
            </span>
            <ChevronDown size={14} className={`text-zinc-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>

          {open && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl overflow-hidden">
              {/* Search */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
                <Search size={13} className="text-zinc-400 shrink-0" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search"
                  className="flex-1 text-sm bg-transparent outline-none text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400"
                />
              </div>

              {/* Options */}
              <div className="max-h-52 overflow-y-auto py-1">
                {filtered.length > 0 ? (
                  filtered.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => selectVariable(name)}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between group ${
                        name === variableName
                          ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                          : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {name}
                    </button>
                  ))
                ) : (
                  <p className="px-4 py-3 text-xs text-zinc-400">No variables found</p>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => { setOpen(false); setSearch(""); setModalOpen(true); }}
                  className="w-full px-4 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors text-center"
                >
                  Create variable
                </button>
              </div>
            </div>
          )}
        </div>
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
    </>
  );
}
