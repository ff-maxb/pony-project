"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Workflow } from "@inngest/workflow-kit";
import { actionsDefinition } from "@/inngest/actions-definition";
import TriggerNode from "./nodes/TriggerNode";
import ActionNode from "./nodes/ActionNode";
import LogicNode from "./nodes/LogicNode";

const LOGIC_KINDS = new Set(["builtin:if", "logic_delay"]);

const nodeTypes = { trigger: TriggerNode, action: ActionNode, logic: LogicNode };

function toReactFlow(workflow: Workflow): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    { id: "trigger", type: "trigger", position: { x: 250, y: 50 }, data: {} },
  ];
  workflow.actions.forEach((action, i) => {
    nodes.push({
      id: action.id,
      type: LOGIC_KINDS.has(action.kind) ? "logic" : "action",
      position: { x: 250, y: 180 + i * 140 },
      data: { kind: action.kind, name: action.name ?? action.kind, inputs: action.inputs ?? {} },
    });
  });
  const edges: Edge[] = workflow.edges.map((e) => {
    let sourceHandle: string | undefined;
    if (e.conditional?.type === "if") sourceHandle = "true";
    else if (e.conditional?.type === "else") sourceHandle = "false";
    return {
      id: `e-${e.from}-${e.to}`,
      source: e.from === "$source" ? "trigger" : e.from,
      target: e.to,
      sourceHandle,
      animated: true,
      label: e.conditional?.type === "if" ? "True" : e.conditional?.type === "else" ? "False" : undefined,
    };
  });
  return { nodes, edges };
}

function toInngestFormat(nodes: Node[], edges: Edge[]): Workflow {
  const actions = nodes
    .filter((n) => n.type === "action" || n.type === "logic")
    .map((n) => ({
      id: n.id,
      kind: n.data.kind as string,
      name: n.data.name as string,
      inputs: (n.data.inputs ?? {}) as Record<string, unknown>,
    }));
  const inngestEdges = edges.map((e) => {
    const from = e.source === "trigger" ? "$source" : e.source;
    const sourceNode = nodes.find((n) => n.id === e.source);
    const isCondition = sourceNode?.data?.kind === "builtin:if";
    if (isCondition && e.sourceHandle === "true") {
      return { from, to: e.target, conditional: { type: "if" as const, ref: "!ref($.result)" } };
    }
    if (isCondition && e.sourceHandle === "false") {
      return { from, to: e.target, conditional: { type: "else" as const, ref: "!ref($.result)" } };
    }
    return { from, to: e.target };
  });
  return { actions, edges: inngestEdges };
}

interface WorkflowCanvasProps {
  workflowId: string;
  initialDefinition?: Workflow;
  onSave: (workflow: Workflow) => Promise<void>;
  onRegisterSave?: (fn: () => Promise<void>) => void;
  status?: string;
}

interface PaletteItem {
  kind?: string;        // maps to actionsDefinition; undefined = not wired yet
  label: string;
  description: string;
  icon: string;
  comingSoon?: boolean;
}

interface PaletteGroup {
  id: string;
  label: string;
  icon: string;
  /** Tailwind classes for the active/hover chip — must be static strings for JIT */
  activeClass: string;
  hoverClass: string;
  iconBg: string;
  labelColor: string;
  items: PaletteItem[];
}

const PALETTE_GROUPS: PaletteGroup[] = [
  {
    id: "triggers",
    label: "Triggers",
    icon: "⚡",
    activeClass: "bg-indigo-50 dark:bg-indigo-950",
    hoverClass: "hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40",
    iconBg: "bg-indigo-100 dark:bg-indigo-900",
    labelColor: "text-indigo-500 dark:text-indigo-400",
    items: [
      { icon: "🔗", label: "Webhook", description: "Start on incoming HTTP request", comingSoon: true },
      { icon: "🕐", label: "Schedule", description: "Run on a cron schedule", comingSoon: true },
      { icon: "▶", label: "Manual", description: "Trigger manually or via API", comingSoon: true },
    ],
  },
  {
    id: "logic",
    label: "Logic",
    icon: "⬡",
    activeClass: "bg-amber-50 dark:bg-amber-950",
    hoverClass: "hover:bg-amber-50/60 dark:hover:bg-amber-950/40",
    iconBg: "bg-amber-100 dark:bg-amber-900",
    labelColor: "text-amber-500 dark:text-amber-400",
    items: [
      { kind: "builtin:if", icon: "⑂", label: "If / Condition", description: "Branch based on a condition" },
      { kind: "logic_delay", icon: "⏱", label: "Delay", description: "Wait a duration before continuing" },
      { icon: "⑃", label: "Split", description: "Run multiple branches in parallel", comingSoon: true },
    ],
  },
  {
    id: "ai",
    label: "AI",
    icon: "✦",
    activeClass: "bg-violet-50 dark:bg-violet-950",
    hoverClass: "hover:bg-violet-50/60 dark:hover:bg-violet-950/40",
    iconBg: "bg-violet-100 dark:bg-violet-900",
    labelColor: "text-violet-500 dark:text-violet-400",
    items: [
      { icon: "✦", label: "Generate Text", description: "Use an LLM to generate or transform text", comingSoon: true },
      { icon: "↳", label: "Classify & Route", description: "Route workflow based on AI classification", comingSoon: true },
      { icon: "🔍", label: "Extract Data", description: "Extract structured data from unstructured text", comingSoon: true },
    ],
  },
  {
    id: "api",
    label: "API",
    icon: "🔌",
    activeClass: "bg-sky-50 dark:bg-sky-950",
    hoverClass: "hover:bg-sky-50/60 dark:hover:bg-sky-950/40",
    iconBg: "bg-sky-100 dark:bg-sky-900",
    labelColor: "text-sky-500 dark:text-sky-400",
    items: [
      { kind: "http_request", icon: "🌐", label: "HTTP Request", description: "Make a request to any URL" },
    ],
  },
  {
    id: "apps",
    label: "Apps",
    icon: "◈",
    activeClass: "bg-emerald-50 dark:bg-emerald-950",
    hoverClass: "hover:bg-emerald-50/60 dark:hover:bg-emerald-950/40",
    iconBg: "bg-emerald-100 dark:bg-emerald-900",
    labelColor: "text-emerald-500 dark:text-emerald-400",
    items: [
      { kind: "slack_send_message", icon: "💬", label: "Slack: Send Message", description: "Send a message to a Slack channel" },
      { kind: "gmail_send_email", icon: "📧", label: "Gmail: Send Email", description: "Send an email via Gmail" },
      { kind: "google_sheets_append_row", icon: "📊", label: "Sheets: Append Row", description: "Append a row to a Google Sheet" },
      { icon: "📋", label: "Linear: Create Issue", description: "Create an issue in Linear", comingSoon: true },
    ],
  },
];

function Canvas({ workflowId, initialDefinition, onSave, onRegisterSave, status }: WorkflowCanvasProps) {
  const { nodes: initNodes, edges: initEdges } = toReactFlow(
    initialDefinition ?? { actions: [], edges: [] }
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [panelGroup, setPanelGroup] = useState<string | null>(null);
  const [panelTop, setPanelTop] = useState(0);
  const handleSaveRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; data?: unknown; error?: string } | null>(null);
  const idCounter = useRef(Date.now());
  const { screenToFlowPosition } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Custom drag state
  const [dragKind, setDragKind] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const dragStartPos = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedAction =
    selectedNode?.type === "action" || selectedNode?.type === "logic"
      ? actionsDefinition.find((a) => a.kind === (selectedNode.data.kind as string))
      : null;

  // Keep a snapshot so the panel content doesn't blank out mid-slide-out
  const panelSnapshotRef = useRef<{ node: typeof selectedNode; action: typeof selectedAction }>({
    node: undefined,
    action: undefined,
  });
  if (selectedNode && selectedAction) {
    panelSnapshotRef.current = { node: selectedNode, action: selectedAction };
  }
  const panelNode = panelSnapshotRef.current.node;
  const panelAction = panelSnapshotRef.current.action;
  const panelOpen = !!(selectedNode && selectedAction);

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
    [setEdges]
  );

  function addAction(kind: string, position?: { x: number; y: number }) {
    const def = actionsDefinition.find((a) => a.kind === kind);
    if (!def) return;
    const id = `action-${idCounter.current++}`;
    const nonTriggerCount = nodes.filter((n) => n.type === "action" || n.type === "logic").length;
    const nodeType = LOGIC_KINDS.has(kind) ? "logic" : "action";
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: nodeType,
        position: position ?? { x: 250, y: 180 + nonTriggerCount * 140 },
        data: { kind, name: def.name, inputs: {} },
      },
    ]);
  }

  function startDrag(e: React.MouseEvent, kind: string) {
    e.preventDefault();
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    isDragging.current = false;
    setDragPos({ x: e.clientX, y: e.clientY });

    function onMouseMove(me: MouseEvent) {
      setDragPos({ x: me.clientX, y: me.clientY });
      const dx = me.clientX - dragStartPos.current.x;
      const dy = me.clientY - dragStartPos.current.y;
      if (!isDragging.current && Math.hypot(dx, dy) > 6) {
        isDragging.current = true;
        setDragKind(kind);
        setActiveGroup(null);
      }
    }

    function onMouseUp(me: MouseEvent) {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      if (isDragging.current && canvasRef.current) {
        // Dropped while dragging — place at cursor position if over canvas
        const rect = canvasRef.current.getBoundingClientRect();
        if (
          me.clientX >= rect.left && me.clientX <= rect.right &&
          me.clientY >= rect.top && me.clientY <= rect.bottom
        ) {
          addAction(kind, screenToFlowPosition({ x: me.clientX, y: me.clientY }));
        }
      } else if (!isDragging.current) {
        // Plain click — add at default position
        addAction(kind);
        setActiveGroup(null);
      }

      isDragging.current = false;
      setDragKind(null);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function updateInput(nodeId: string, key: string, value: string) {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, inputs: { ...(n.data.inputs as object), [key]: value } } }
          : n
      )
    );
  }

  function removeNode(nodeId: string) {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNodeId(null);
  }

  async function handleSave() {
    setSaving(true);
    await onSave(toInngestFormat(nodes, edges));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // Clear test result when switching nodes
  useEffect(() => {
    setTestResult(null);
  }, [selectedNodeId]);

  async function testAction() {
    if (!panelNode || !panelAction) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/actions/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId,
          kind: panelNode.data.kind,
          inputs: panelNode.data.inputs ?? {},
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setTestResult({ success: true, data: json.result });
      } else {
        setTestResult({ success: false, error: json.error ?? "Unknown error" });
      }
    } catch (err) {
      setTestResult({ success: false, error: err instanceof Error ? err.message : "Network error" });
    } finally {
      setTesting(false);
    }
  }

  // Keep ref fresh every render so parent always calls the latest version
  handleSaveRef.current = handleSave;

  // Register once on mount
  useEffect(() => {
    onRegisterSave?.(() => handleSaveRef.current());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterSave]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative">
          {/* Floating save button + status badge */}
          <div className="absolute top-4 z-10 right-4 flex items-center gap-2">
            {status && status !== "draft" && (
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium shadow-lg border backdrop-blur-md ${
                  status === "active"
                    ? "bg-emerald-50/90 dark:bg-emerald-950/90 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-700/80"
                    : "bg-amber-50/90 dark:bg-amber-950/90 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-700/80"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    status === "active" ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                {status === "active" ? "Active" : "Paused"}
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 bg-zinc-900/90 dark:bg-zinc-100/90 backdrop-blur-md text-white dark:text-zinc-900 rounded-xl text-sm font-medium shadow-lg border border-zinc-700/20 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : saved ? "✓ Saved" : "Save"}
            </button>
          </div>

          {/* Floating action palette */}
          <div className="absolute left-4 top-16 z-10 pointer-events-none">
            {/* Wrap strip + panel so leaving either one closes both */}
            <div
              className="relative pointer-events-auto"
              onMouseLeave={() => setActiveGroup(null)}
            >
              {/* Icon strip */}
              <div className="flex flex-col gap-0.5 p-2 bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-700">
                <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest mb-1.5 text-center px-1">
                  Add
                </p>
                {PALETTE_GROUPS.map((group) => {
                  const isActive = activeGroup === group.id;
                  return (
                    <button
                      key={group.id}
                      onMouseEnter={(e) => {
                        setActiveGroup(group.id);
                        setPanelGroup(group.id);
                        setPanelTop((e.currentTarget as HTMLButtonElement).offsetTop);
                      }}
                      title={group.label}
                      className={`flex flex-col items-center gap-1 w-12 py-2 rounded-xl transition-all ${
                        isActive ? group.activeClass : group.hoverClass
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg leading-none ${group.iconBg}`}
                      >
                        {group.icon}
                      </span>
                      <span className={`text-[10px] font-medium leading-none ${group.labelColor}`}>
                        {group.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Expanded item list — flies alongside strip */}
              {panelGroup && (() => {
                const group = PALETTE_GROUPS.find((g) => g.id === panelGroup)!;
                return (
                  <div
                    style={{ top: panelTop }}
                    className={`absolute left-[72px] w-52 bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-700 py-3 px-2 overflow-y-auto max-h-[calc(100vh-10rem)] transition-[top,opacity] duration-150 ease-out ${
                      activeGroup ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                  >
                  <p className={`text-[10px] font-semibold uppercase tracking-wide mb-2 px-2 ${group.labelColor}`}>
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => (
                      <button
                        key={item.kind ?? item.label}
                        disabled={item.comingSoon}
                        onMouseDown={(e) => {
                          if (item.kind && !item.comingSoon) startDrag(e, item.kind);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2.5 transition-colors select-none ${
                          item.comingSoon
                            ? "opacity-45 cursor-not-allowed"
                            : "hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-grab"
                        }`}
                      >
                        <span className={`w-7 h-7 rounded-md flex items-center justify-center text-sm shrink-0 ${group.iconBg}`}>
                          {item.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 leading-tight truncate">
                              {item.label}
                            </p>
                            {item.comingSoon && (
                              <span className="shrink-0 text-[9px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                                Soon
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-400 mt-0.5 leading-tight line-clamp-2">
                            {item.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
            </div>{/* end relative wrapper */}
          </div>{/* end floating palette */}

          {/* Drag ghost */}
          {dragKind && (() => {
            const def = actionsDefinition.find((a) => a.kind === dragKind);
            const group = PALETTE_GROUPS.find((g) => g.items.some((i) => i.kind === dragKind));
            return (
              <div
                style={{ left: dragPos.x, top: dragPos.y }}
                className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-1/2"
              >
                <div className={`px-3 py-2 rounded-xl border-2 border-zinc-400 bg-white dark:bg-zinc-900 shadow-2xl opacity-90 min-w-[140px]`}>
                  {group && (
                    <span className={`text-[10px] font-semibold uppercase tracking-wide ${group.labelColor}`}>
                      {group.label}
                    </span>
                  )}
                  <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">{def?.name}</p>
                </div>
              </div>
            );
          })()}

          <ReactFlow
            ref={canvasRef}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) =>
              setSelectedNodeId(node.id === selectedNodeId ? null : node.id)
            }
            onPaneClick={() => setSelectedNodeId(null)}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>

          {/* Floating config panel */}
          <div
            className={`absolute inset-y-4 right-4 z-20 w-72 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 transition-all duration-300 ease-in-out ${
              panelOpen ? "translate-x-0 opacity-100" : "translate-x-[calc(100%+1rem)] opacity-0 pointer-events-none"
            }`}
          >
            {panelNode && panelAction && (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {panelNode.data.name as string}
                  </h3>
                  <button
                    onClick={() => setSelectedNodeId(null)}
                    className="text-zinc-400 hover:text-zinc-600 text-xl leading-none"
                  >
                    ×
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {Object.entries(panelAction.inputs ?? {}).map(([key, input]) => {
                    const inputDef = input as {
                      type: { title?: string; description?: string };
                      fieldType?: string;
                    };
                    const value = (
                      ((panelNode.data.inputs as Record<string, unknown>)?.[key] ?? "") as string
                    );
                    return (
                      <div key={key}>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                          {inputDef.type?.title ?? key}
                        </label>
                        {inputDef.type?.description && (
                          <p className="text-[10px] text-zinc-400 mb-1">{inputDef.type.description}</p>
                        )}
                        {inputDef.fieldType === "textarea" ? (
                          <textarea
                            value={value}
                            onChange={(e) => updateInput(panelNode.id, key, e.target.value)}
                            rows={3}
                            className="w-full text-xs border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 resize-none focus:outline-none focus:ring-1 focus:ring-zinc-400"
                          />
                        ) : (
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => updateInput(panelNode.id, key, e.target.value)}
                            className="w-full text-xs border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                          />
                        )}
                      </div>
                    );
                  })}

                  {testResult && (
                    <div
                      className={`rounded-lg p-2.5 border text-xs ${
                        testResult.success
                          ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800"
                          : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
                      }`}
                    >
                      <p
                        className={`font-semibold mb-1 ${
                          testResult.success
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-red-700 dark:text-red-300"
                        }`}
                      >
                        {testResult.success ? "✓ Success" : "✗ Error"}
                      </p>
                      {testResult.error && (
                        <p className="text-red-600 dark:text-red-400 break-words">{testResult.error}</p>
                      )}
                      {testResult.data !== undefined && (
                        <pre className="text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap break-all text-[10px] max-h-32 overflow-y-auto mt-1">
                          {JSON.stringify(testResult.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
                <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                  <button
                    onClick={testAction}
                    disabled={testing}
                    className="w-full px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                  >
                    {testing ? "Testing…" : "Test action"}
                  </button>
                  <button
                    onClick={() => removeNode(panelNode.id)}
                    className="w-full px-3 py-1.5 text-xs text-red-500 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                  >
                    Remove action
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}



