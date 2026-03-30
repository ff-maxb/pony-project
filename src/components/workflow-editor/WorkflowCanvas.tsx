"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Nango from "@nangohq/frontend";
import { toast } from "sonner";
import {
  Zap, GitBranch, Sparkles, Plug, LayoutGrid,
  Link, Clock, Play, Timer, Variable, GitFork,
  Bot, Route, FileSearch, Globe, Mail, MessageSquare,
} from "lucide-react";
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
import { AVAILABLE_INTEGRATIONS } from "@/types/workflow";
import TriggerNode from "./nodes/TriggerNode";
import ActionNode from "./nodes/ActionNode";
import LinearNode from "./nodes/LinearNode";
import CalendlyNode from "./nodes/CalendlyNode";
import GmailNode from "./nodes/GmailNode";
import SlackNode from "./nodes/SlackNode";
import SendGridNode from "./nodes/SendGridNode";
import TwilioNode from "./nodes/TwilioNode";
import LogicNode from "./nodes/LogicNode";
import DelayPanel from "./panels/DelayPanel";
import ConditionPanel from "./panels/ConditionPanel";
import SetVariablePanel from "./panels/SetVariablePanel";

const LOGIC_KINDS = new Set(["builtin:if", "logic_delay", "logic_set_variables"]);

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  logic: LogicNode,
  linear: LinearNode,
  calendly: CalendlyNode,
  gmail: GmailNode,
  slack: SlackNode,
  sendgrid: SendGridNode,
  twilio: TwilioNode,
};

function toReactFlow(workflow: Workflow): { nodes: Node[]; edges: Edge[] } {
  const positions = (workflow.metadata?.positions ?? {}) as Record<string, { x: number; y: number }>;
  const nodes: Node[] = [
    { id: "trigger", type: "trigger", position: positions["trigger"] ?? { x: 250, y: 50 }, data: {} },
  ];
  workflow.actions.forEach((action, i) => {
    nodes.push({
      id: action.id,
      type: LOGIC_KINDS.has(action.kind)
        ? "logic"
        : LINEAR_KINDS.has(action.kind)
          ? "linear"
          : CALENDLY_KINDS.has(action.kind)
            ? "calendly"
            : GMAIL_KINDS.has(action.kind)
              ? "gmail"
              : SLACK_KINDS.has(action.kind)
                ? "slack"
                : SENDGRID_KINDS.has(action.kind)
                  ? "sendgrid"
                  : TWILIO_KINDS.has(action.kind)
                    ? "twilio"
                    : "action",
      position: positions[action.id] ?? { x: 250, y: 180 + i * 140 },
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
    .filter(
      (n) =>
        n.type === "action" || n.type === "logic" || n.type === "linear" || n.type === "calendly" || n.type === "gmail" || n.type === "slack" || n.type === "sendgrid" || n.type === "twilio"
    )
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
  const positions: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) positions[n.id] = n.position;
  return { actions, edges: inngestEdges, metadata: { positions } };
}

const LINEAR_KINDS = new Set(["linear_create_issue", "linear_update_issue"]);
const CALENDLY_KINDS = new Set(["calendly_create_scheduling_link"]);
const GMAIL_KINDS = new Set(["gmail_send_email"]);
const SLACK_KINDS = new Set(["slack_send_message"]);
const SENDGRID_KINDS = new Set(["sendgrid_send_email"]);
const TWILIO_KINDS = new Set(["twilio_send_sms"]);
const INTEGRATION_ACTIONS_BY_KIND = new Map(
  AVAILABLE_INTEGRATIONS.flatMap((integration) =>
    integration.actions.map((action) => [action.kind, integration.actions] as const)
  )
);
const DEFAULT_WORKFLOW_VARIABLES = ["name", "email", "phone"];

function parseVariablesObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") return {};

  const raw = value.trim();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
}

interface WorkflowCanvasProps {
  workflowId: string;
  teamId?: string;
  initialDefinition?: Workflow;
  onSave: (workflow: Workflow) => Promise<void>;
  onRegisterSave?: (fn: () => Promise<void>) => void;
  status?: string;
}

interface PaletteItem {
  kind?: string;        // maps to actionsDefinition; undefined = not wired yet
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }> | string; // Lucide component OR "/" path for <img>
  comingSoon?: boolean;
}

interface PaletteGroup {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  /** Tailwind classes for the active/hover chip — must be static strings for JIT */
  activeClass: string;
  hoverClass: string;
  iconBg: string;
  labelColor: string;
  iconColor: string;
  items: PaletteItem[];
}

const PALETTE_GROUPS: PaletteGroup[] = [
  {
    id: "triggers",
    label: "Triggers",
    icon: Zap,
    activeClass: "bg-indigo-50 dark:bg-indigo-950",
    hoverClass: "hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40",
    iconBg: "bg-indigo-100 dark:bg-indigo-900",
    labelColor: "text-indigo-500 dark:text-indigo-400",
    iconColor: "text-indigo-500 dark:text-indigo-400",
    items: [
      { icon: Link, label: "Webhook", description: "Start on incoming HTTP request", comingSoon: true },
      { icon: Clock, label: "Schedule", description: "Run on a cron schedule", comingSoon: true },
      { icon: Play, label: "Manual", description: "Trigger manually or via API", comingSoon: true },
    ],
  },
  {
    id: "logic",
    label: "Logic",
    icon: GitBranch,
    activeClass: "bg-amber-50 dark:bg-amber-950",
    hoverClass: "hover:bg-amber-50/60 dark:hover:bg-amber-950/40",
    iconBg: "bg-amber-100 dark:bg-amber-900",
    labelColor: "text-amber-500 dark:text-amber-400",
    iconColor: "text-amber-500 dark:text-amber-400",
    items: [
      { kind: "builtin:if", icon: GitBranch, label: "If / Condition", description: "Branch based on a condition" },
      { kind: "logic_delay", icon: Timer, label: "Delay", description: "Wait a duration before continuing" },
      { kind: "logic_set_variables", icon: Variable, label: "Set Variables", description: "Set reusable variables for later steps" },
      { icon: GitFork, label: "Split", description: "Run multiple branches in parallel", comingSoon: true },
    ],
  },
  {
    id: "ai",
    label: "AI",
    icon: Sparkles,
    activeClass: "bg-violet-50 dark:bg-violet-950",
    hoverClass: "hover:bg-violet-50/60 dark:hover:bg-violet-950/40",
    iconBg: "bg-violet-100 dark:bg-violet-900",
    labelColor: "text-violet-500 dark:text-violet-400",
    iconColor: "text-violet-500 dark:text-violet-400",
    items: [
      { icon: Sparkles, label: "Generate Text", description: "Use an LLM to generate or transform text", comingSoon: true },
      { icon: Route, label: "Classify & Route", description: "Route workflow based on AI classification", comingSoon: true },
      { icon: FileSearch, label: "Extract Data", description: "Extract structured data from unstructured text", comingSoon: true },
    ],
  },
  {
    id: "api",
    label: "API",
    icon: Plug,
    activeClass: "bg-sky-50 dark:bg-sky-950",
    hoverClass: "hover:bg-sky-50/60 dark:hover:bg-sky-950/40",
    iconBg: "bg-sky-100 dark:bg-sky-900",
    labelColor: "text-sky-500 dark:text-sky-400",
    iconColor: "text-sky-500 dark:text-sky-400",
    items: [
      { kind: "http_request", icon: Globe, label: "HTTP Request", description: "Make a request to any URL" },
    ],
  },
  {
    id: "apps",
    label: "Apps",
    icon: LayoutGrid,
    activeClass: "bg-emerald-50 dark:bg-emerald-950",
    hoverClass: "hover:bg-emerald-50/60 dark:hover:bg-emerald-950/40",
    iconBg: "bg-emerald-100 dark:bg-emerald-900",
    labelColor: "text-emerald-500 dark:text-emerald-400",
    iconColor: "text-emerald-500 dark:text-emerald-400",
    items: [
      { kind: "slack_send_message", icon: "/integrations/slack.svg", label: "Slack", description: "Send a message to a Slack channel" },
      { kind: "gmail_send_email", icon: "/integrations/gmail.svg", label: "Gmail", description: "Send an email via Gmail" },
      { kind: "google_sheets_append_row", icon: "/integrations/google-sheets.svg", label: "Google Sheets", description: "Append a row to a Google Sheet" },
      { kind: "linear_create_issue", icon: "/integrations/linear.svg", label: "Linear", description: "Create and manage Linear issues" },
      { kind: "calendly_create_scheduling_link", icon: "/integrations/calendly.svg", label: "Calendly", description: "Generate one-off scheduling links" },
    ],
  },
  {
    id: "messaging",
    label: "Messaging",
    icon: Mail,
    activeClass: "bg-zinc-50 dark:bg-zinc-900",
    hoverClass: "hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40",
    iconBg: "bg-zinc-100 dark:bg-zinc-800",
    labelColor: "text-zinc-500 dark:text-zinc-400",
    iconColor: "text-zinc-500 dark:text-zinc-400",
    items: [
      { kind: "sendgrid_send_email", icon: Mail, label: "Send Email", description: "Send an email" },
      { kind: "twilio_send_sms", icon: MessageSquare, label: "Send SMS", description: "Send an SMS message" },
    ],
  },
];

function Canvas({ workflowId, teamId, initialDefinition, onSave, onRegisterSave, status }: WorkflowCanvasProps) {
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
  const [saveError, setSaveError] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const [playing, setPlaying] = useState(false);
  const [testing, setTesting] = useState(false);
  const [linearConnected, setLinearConnected] = useState<boolean | null>(null);
  const [connectingLinear, setConnectingLinear] = useState(false);
  const [linearTeams, setLinearTeams] = useState<Array<{ id: string; name: string; key: string }>>([]);
  const [calendlyConnected, setCalendlyConnected] = useState<boolean | null>(null);
  const [connectingCalendly, setConnectingCalendly] = useState(false);
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; data?: unknown; error?: string } | null>(null);
  const [focusedInputKey, setFocusedInputKey] = useState<string | null>(null);
  const idCounter = useRef(Date.now());
  const { screenToFlowPosition, fitView, setCenter } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Custom drag state
  const [dragKind, setDragKind] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const dragStartPos = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedAction =
    selectedNode?.type === "action" ||
    selectedNode?.type === "logic" ||
    selectedNode?.type === "linear" ||
    selectedNode?.type === "calendly" ||
    selectedNode?.type === "gmail" ||
    selectedNode?.type === "slack" ||
    selectedNode?.type === "sendgrid" ||
    selectedNode?.type === "twilio"
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
  const panelIntegrationActions = panelNode
    ? INTEGRATION_ACTIONS_BY_KIND.get(panelNode.data.kind as string) ?? []
    : [];
  const variableSuggestions = [
    { label: "Trigger value", token: "{{event.data.field}}" },
    { label: "Trigger raw payload", token: "{{event.data}}" },
    { label: "Workflow variable", token: "{{vars.name}}" },
    { label: "Workflow variable", token: "{{vars.email}}" },
    { label: "Workflow variable", token: "{{vars.phone}}" },
    { label: "Workflow variable", token: "{{variables.name}}" },
    { label: "Ref syntax", token: "!ref($.event.data.field)" },
    ...nodes
      .filter(
        (n) =>
          n.id !== panelNode?.id &&
          (n.type === "action" || n.type === "logic" || n.type === "linear" || n.type === "calendly" || n.type === "gmail" || n.type === "slack")
      )
      .slice(0, 3)
      .map((n) => ({
        label: `${(n.data.name as string) || n.id}`,
        token: `{{steps.${n.id}}}`,
      })),
  ];
  const knownVariableNames = Array.from(
    new Set(
      [
        ...DEFAULT_WORKFLOW_VARIABLES,
        ...nodes
        .filter((n) => n.type === "logic" && n.data.kind === "logic_set_variables")
        .flatMap((n) => {
          const inputs = (n.data.inputs ?? {}) as Record<string, unknown>;
          const fromJson = Object.keys(parseVariablesObject(inputs.variables_json));
          const directName = typeof inputs.variable_name === "string" ? [inputs.variable_name] : [];
          return [...fromJson, ...directName].map((name) => name.trim()).filter(Boolean);
        }),
      ]
    )
  );

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
    [setEdges]
  );

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getExecutionOrder(nodesSnapshot: Node[], edgesSnapshot: Edge[]) {
    const byId = new Map(nodesSnapshot.map((n) => [n.id, n]));
    const outgoing = new Map<string, string[]>();

    for (const edge of edgesSnapshot) {
      const list = outgoing.get(edge.source) ?? [];
      list.push(edge.target);
      outgoing.set(edge.source, list);
    }

    for (const [source, targets] of outgoing.entries()) {
      targets.sort((a, b) => {
        const na = byId.get(a);
        const nb = byId.get(b);
        if (!na || !nb) return 0;
        if (na.position.y !== nb.position.y) return na.position.y - nb.position.y;
        return na.position.x - nb.position.x;
      });
      outgoing.set(source, targets);
    }

    const order: string[] = [];
    const queue: string[] = ["trigger"];
    const seen = new Set<string>();

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (seen.has(nodeId)) continue;
      seen.add(nodeId);
      order.push(nodeId);

      for (const next of outgoing.get(nodeId) ?? []) {
        if (!seen.has(next)) queue.push(next);
      }
    }

    return order;
  }

  async function focusNode(nodeId: string, nodesSnapshot: Node[]) {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === nodeId })));
    setSelectedNodeId(nodeId === "trigger" ? null : nodeId);
    const node = nodesSnapshot.find((n) => n.id === nodeId);
    if (!node) return;
    const width = node.width ?? 180;
    const height = node.height ?? 80;
    await setCenter(node.position.x + width / 2, node.position.y + height / 2, {
      duration: 450,
      zoom: 1,
    });
  }

  async function playWorkflow() {
    if (playing) return;
    const nodesSnapshot = [...nodes];
    const edgesSnapshot = [...edges];
    const plannedOrder = getExecutionOrder(nodesSnapshot, edgesSnapshot);

    if (nodesSnapshot.length <= 1) {
      toast.error("Add at least one action node before running");
      return;
    }

    setPlaying(true);
    setSelectedNodeId(null);
    setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));

    try {
      await fitView({ duration: 500, padding: 0.2 });
      await sleep(250);
      await focusNode("trigger", nodesSnapshot);

      const executeRes = await fetch(`/api/workflows/${workflowId}/execute?playMode=1`, {
        method: "POST",
        headers: { "x-play-mode": "1" },
      });
      if (!executeRes.ok) {
        const raw = await executeRes.text();
        let msg = "";
        try {
          const parsed = JSON.parse(raw) as { error?: string };
          msg = parsed?.error ?? "";
        } catch {
          msg = raw.trim();
        }
        throw new Error(msg || `Execution failed (${executeRes.status})`);
      }
      const { executionId } = (await executeRes.json()) as { executionId: string };

      const seen = new Set<string>();
      const terminalStatuses = new Set(["completed", "failed", "cancelled"]);
      let movedToFirstPlannedNode = false;
      const startedAt = Date.now();
      const pendingTimeoutMs = 30000;

      while (true) {
        const detailRes = await fetch(`/api/executions/${executionId}`, { cache: "no-store" });
        if (!detailRes.ok) throw new Error("Failed to poll execution status");

        const detail = (await detailRes.json()) as {
          status: string;
          steps?: Array<{ node_id: string }>;
        };

        if (
          detail.status === "pending" &&
          Date.now() - startedAt > pendingTimeoutMs
        ) {
          throw new Error(
            "Execution is still pending. Ensure Inngest dev is running and INNGEST_BASE_URL points to http://127.0.0.1:8288"
          );
        }

        for (const step of detail.steps ?? []) {
          if (!step.node_id || seen.has(step.node_id)) continue;
          seen.add(step.node_id);
          await focusNode(step.node_id, nodesSnapshot);
          await sleep(450);
        }

        // If execution started but no completed step has been written yet,
        // move to the first planned node so we don't appear stuck on trigger.
        if (
          !movedToFirstPlannedNode &&
          (detail.status === "running" || detail.status === "pending") &&
          seen.size === 0 &&
          plannedOrder.length > 1
        ) {
          movedToFirstPlannedNode = true;
          await focusNode(plannedOrder[1], nodesSnapshot);
        }

        if (terminalStatuses.has(detail.status)) {
          if (detail.status === "completed") toast.success("Workflow run completed");
          else toast.error(`Workflow run ${detail.status}`);
          break;
        }

        await sleep(800);
      }

      await fitView({ duration: 500, padding: 0.2 });
    } finally {
      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
      setSelectedNodeId(null);
      setPlaying(false);
    }
  }

  function addAction(kind: string, position?: { x: number; y: number }) {
    const def = actionsDefinition.find((a) => a.kind === kind);
    if (!def) return;
    const id = `action-${idCounter.current++}`;
    const nonTriggerCount = nodes.filter(
      (n) => n.type === "action" || n.type === "logic" || n.type === "linear" || n.type === "calendly" || n.type === "gmail" || n.type === "slack" || n.type === "sendgrid" || n.type === "twilio"
    ).length;
    const nodeType = LOGIC_KINDS.has(kind)
      ? "logic"
      : LINEAR_KINDS.has(kind)
        ? "linear"
        : CALENDLY_KINDS.has(kind)
          ? "calendly"
          : GMAIL_KINDS.has(kind)
            ? "gmail"
            : SLACK_KINDS.has(kind)
              ? "slack"
              : SENDGRID_KINDS.has(kind)
                ? "sendgrid"
                : TWILIO_KINDS.has(kind)
                  ? "twilio"
                  : "action";
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

  function updateNodeKind(nodeId: string, newKind: string) {
    const def = actionsDefinition.find((a) => a.kind === newKind);
    if (!def) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              type: LOGIC_KINDS.has(newKind)
                ? "logic"
                : LINEAR_KINDS.has(newKind)
                  ? "linear"
                  : CALENDLY_KINDS.has(newKind)
                    ? "calendly"
                    : GMAIL_KINDS.has(newKind)
                      ? "gmail"
                      : SLACK_KINDS.has(newKind)
                        ? "slack"
                        : SENDGRID_KINDS.has(newKind)
                          ? "sendgrid"
                          : TWILIO_KINDS.has(newKind)
                            ? "twilio"
                            : "action",
              data: { ...n.data, kind: newKind, name: def.name, inputs: {} },
            }
          : n
      )
    );
  }

  function insertVariableToken(token: string) {
    if (!panelNode || !focusedInputKey) return;
    const currentValue = ((panelNode.data.inputs as Record<string, unknown>)?.[focusedInputKey] ?? "") as string;
    const spacer = currentValue && !currentValue.endsWith(" ") ? " " : "";
    updateInput(panelNode.id, focusedInputKey, `${currentValue}${spacer}${token}`);
  }

  function updateSetVariablesInput(
    nodeId: string,
    next: { variableName: string; mode: "value" | "expression"; inputValue: string }
  ) {
    const trimmedName = next.variableName.trim();
    const trimmedInput = next.inputValue.trim();
    const finalValue =
      next.mode === "expression"
        ? trimmedInput.startsWith("{{") || trimmedInput.startsWith("!ref(")
          ? next.inputValue
          : trimmedInput
            ? `{{${trimmedInput}}}`
            : ""
        : next.inputValue;

    const variablesObj = trimmedName ? { [trimmedName]: finalValue } : {};

    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                inputs: {
                  ...(n.data.inputs as object),
                  variable_name: next.variableName,
                  set_mode: next.mode,
                  value: next.mode === "value" ? next.inputValue : "",
                  expression: next.mode === "expression" ? next.inputValue : "",
                  variables_json: JSON.stringify(variablesObj),
                },
              },
            }
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
    setSaveError(false);
    try {
      await onSave(toInngestFormat(nodes, edges));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  // Clear test result when switching nodes
  useEffect(() => {
    setTestResult(null);
    setFocusedInputKey(null);
  }, [selectedNodeId]);

  // Check integration connection for selected app node
  useEffect(() => {
    const kind = selectedNode?.data?.kind as string | undefined;
    if (!kind || !teamId) {
      setLinearConnected(null);
      setLinearTeams([]);
      setCalendlyConnected(null);
      setGmailConnected(null);
      return;
    }

    if (LINEAR_KINDS.has(kind)) {
      setCalendlyConnected(null);
      setLinearConnected(null);
      setLinearTeams([]);
      fetch(`/api/integrations?teamId=${teamId}`)
        .then((r) => r.json())
        .then((data: Array<{ integration_id: string }>) => {
          const connected = data.some((c) => c.integration_id === "linear");
          setLinearConnected(connected);
          if (connected) {
            fetch(`/api/integrations/linear/teams?teamId=${teamId}`)
              .then((r) => r.json())
              .then((teams) => Array.isArray(teams) && setLinearTeams(teams))
              .catch(() => {});
          }
        })
        .catch(() => setLinearConnected(false));
      return;
    }

    setLinearConnected(null);
    setLinearTeams([]);

    if (CALENDLY_KINDS.has(kind)) {
      setCalendlyConnected(null);
      fetch(`/api/integrations?teamId=${teamId}`)
        .then((r) => r.json())
        .then((data: Array<{ integration_id: string }>) => {
          const connected = data.some((c) => c.integration_id === "calendly");
          setCalendlyConnected(connected);
        })
        .catch(() => setCalendlyConnected(false));
      return;
    }

    setCalendlyConnected(null);

    if (GMAIL_KINDS.has(kind)) {
      setGmailConnected(null);
      fetch(`/api/integrations?teamId=${teamId}`)
        .then((r) => r.json())
        .then((data: Array<{ integration_id: string }>) => {
          setGmailConnected(data.some((c) => c.integration_id === "gmail"));
        })
        .catch(() => setGmailConnected(false));
      return;
    }

    setGmailConnected(null);
  }, [selectedNodeId, teamId, selectedNode?.data?.kind]);

  async function connectLinear() {
    if (!teamId) return;
    setConnectingLinear(true);
    try {
      const tokenRes = await fetch("/api/nango/session-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, integrationId: "linear" }),
      });
      if (!tokenRes.ok) return;
      const { sessionToken } = await tokenRes.json();
      const nango = new Nango();
      const connect = nango.openConnectUI({
        onEvent: async (event) => {
          if (event.type === "connect") {
            await fetch("/api/integrations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                teamId,
                integrationId: "linear",
                nangoConnectionId: event.payload.connectionId,
              }),
            });
            setLinearConnected(true);
            toast.success("Linear connected");
            fetch(`/api/integrations/linear/teams?teamId=${teamId}`)
              .then((r) => r.json())
              .then((teams) => Array.isArray(teams) && setLinearTeams(teams))
              .catch(() => {});
          }
        },
      });
      connect.setSessionToken(sessionToken);
    } finally {
      setConnectingLinear(false);
    }
  }

  async function connectCalendly() {
    if (!teamId) return;
    setConnectingCalendly(true);
    try {
      const tokenRes = await fetch("/api/nango/session-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, integrationId: "calendly" }),
      });
      if (!tokenRes.ok) return;
      const { sessionToken } = await tokenRes.json();
      const nango = new Nango();
      const connect = nango.openConnectUI({
        onEvent: async (event) => {
          if (event.type === "connect") {
            await fetch("/api/integrations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                teamId,
                integrationId: "calendly",
                nangoConnectionId: event.payload.connectionId,
              }),
            });
            setCalendlyConnected(true);
            toast.success("Calendly connected");
          }
        },
      });
      connect.setSessionToken(sessionToken);
    } finally {
      setConnectingCalendly(false);
    }
  }

  async function connectGmail() {
    if (!teamId) return;
    setConnectingGmail(true);
    try {
      const tokenRes = await fetch("/api/nango/session-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, integrationId: "gmail" }),
      });
      if (!tokenRes.ok) return;
      const { sessionToken } = await tokenRes.json();
      const nango = new Nango();
      const connect = nango.openConnectUI({
        onEvent: async (event) => {
          if (event.type === "connect") {
            await fetch("/api/integrations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                teamId,
                integrationId: "gmail",
                nangoConnectionId: event.payload.connectionId,
              }),
            });
            setGmailConnected(true);
            toast.success("Gmail connected");
          }
        },
      });
      connect.setSessionToken(sessionToken);
    } finally {
      setConnectingGmail(false);
    }
  }

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
        toast.success("Action test passed");
      } else {
        const msg = json.error ?? "Unknown error";
        setTestResult({ success: false, error: msg });
        toast.error(`Action test failed: ${msg}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setTestResult({ success: false, error: msg });
      toast.error(`Action test failed: ${msg}`);
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

  // Auto-save: debounce 1 s after any node/edge change (skip initial render)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      handleSaveRef.current();
    }, 1000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  // Flush pending auto-save immediately when tab loses visibility
  useEffect(() => {
    function flushOnHide() {
      if (document.visibilityState === "hidden" && autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = null;
        handleSaveRef.current();
      }
    }
    document.addEventListener("visibilitychange", flushOnHide);
    return () => document.removeEventListener("visibilitychange", flushOnHide);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative">
          {/* Floating controls */}
          <div className="absolute top-4 z-10 right-4 flex items-center gap-2">
            <button
              onClick={playWorkflow}
              disabled={playing}
              className="px-4 py-1.5 backdrop-blur-md rounded-xl text-sm font-medium shadow-lg border transition-colors disabled:opacity-50 bg-emerald-600/90 text-white border-emerald-500/30 hover:bg-emerald-700"
            >
              {playing ? "Running..." : "Play"}
            </button>
          </div>

          {/* Status badge — bottom right */}
          <div className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-2">
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
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                      >
                        <group.icon size={18} className={group.iconColor} />
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
                        <span className="w-7 h-7 rounded-md flex items-center justify-center text-sm shrink-0">
                          {typeof item.icon === "string" ? (
                            <img src={item.icon} alt={item.label} className="w-4 h-4 object-contain" />
                          ) : (
                            <item.icon size={15} className={group.iconColor} />
                          )}
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
                  {/* Linear connection banner */}
                  {LINEAR_KINDS.has(panelNode.data.kind as string) && linearConnected === false && (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-3 space-y-2">
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Linear not connected</p>
                      <p className="text-[10px] text-amber-700 dark:text-amber-400">Connect your Linear account to use this action.</p>
                      <button
                        onClick={connectLinear}
                        disabled={connectingLinear}
                        className="w-full px-3 py-1.5 text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        {connectingLinear ? "Connecting…" : "Connect Linear"}
                      </button>
                    </div>
                  )}
                  {LINEAR_KINDS.has(panelNode.data.kind as string) && linearConnected === true && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        Linear connected
                      </div>
                      <button
                        onClick={connectLinear}
                        disabled={connectingLinear}
                        className="text-[10px] text-zinc-400 hover:text-zinc-600 underline disabled:opacity-50"
                      >
                        Reconnect
                      </button>
                    </div>
                  )}
                  {CALENDLY_KINDS.has(panelNode.data.kind as string) && calendlyConnected === false && (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-3 space-y-2">
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Calendly not connected</p>
                      <p className="text-[10px] text-amber-700 dark:text-amber-400">Connect your Calendly account to use this action.</p>
                      <button
                        onClick={connectCalendly}
                        disabled={connectingCalendly}
                        className="w-full px-3 py-1.5 text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        {connectingCalendly ? "Connecting..." : "Connect Calendly"}
                      </button>
                    </div>
                  )}
                  {CALENDLY_KINDS.has(panelNode.data.kind as string) && calendlyConnected === true && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        Calendly connected
                      </div>
                      <button
                        onClick={connectCalendly}
                        disabled={connectingCalendly}
                        className="text-[10px] text-zinc-400 hover:text-zinc-600 underline disabled:opacity-50"
                      >
                        Reconnect
                      </button>
                    </div>
                  )}
                  {/* Gmail connection banner */}
                  {GMAIL_KINDS.has(panelNode.data.kind as string) && gmailConnected === false && (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-3 space-y-2">
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Gmail not connected</p>
                      <p className="text-[10px] text-amber-700 dark:text-amber-400">Connect your Gmail account to use this action.</p>
                      <button
                        onClick={connectGmail}
                        disabled={connectingGmail}
                        className="w-full px-3 py-1.5 text-xs font-medium bg-[#EA4335] hover:bg-[#c5352a] text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        {connectingGmail ? "Connecting…" : "Connect Gmail"}
                      </button>
                    </div>
                  )}
                  {GMAIL_KINDS.has(panelNode.data.kind as string) && gmailConnected === true && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        Gmail connected
                      </div>
                      <button
                        onClick={connectGmail}
                        disabled={connectingGmail}
                        className="text-[10px] text-zinc-400 hover:text-zinc-600 underline disabled:opacity-50"
                      >
                        Reconnect
                      </button>
                    </div>
                  )}
                  {panelIntegrationActions.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Action</label>
                      <select
                        value={panelNode.data.kind as string}
                        onChange={(e) => updateNodeKind(panelNode.id, e.target.value)}
                        className="w-full text-xs border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                      >
                        {panelIntegrationActions.map((action) => (
                          <option key={action.kind} value={action.kind}>
                            {action.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {panelNode.data.kind === "logic_delay" ? (
                    <DelayPanel
                      value={((panelNode.data.inputs as Record<string, unknown>)?.duration ?? "") as string}
                      onChange={(v) => updateInput(panelNode.id, "duration", v)}
                    />
                  ) : panelNode.data.kind === "logic_set_variables" ? (() => {
                    const inputs = (panelNode.data.inputs as Record<string, unknown>) ?? {};
                    const varsFromJson = parseVariablesObject(inputs.variables_json);
                    const firstEntry = Object.entries(varsFromJson)[0];
                    const derivedName = firstEntry?.[0] ?? "";
                    const derivedValue = firstEntry?.[1] ?? "";

                    const variableName = (inputs.variable_name as string) ?? derivedName;
                    const mode =
                      (inputs.set_mode as string) === "expression" ||
                      (typeof derivedValue === "string" && (derivedValue.startsWith("{{") || derivedValue.startsWith("!ref(")))
                        ? "expression"
                        : "value";
                    const inputValue =
                      mode === "expression"
                        ? ((inputs.expression as string) ?? String(derivedValue ?? ""))
                        : ((inputs.value as string) ?? String(derivedValue ?? ""));

                    return (
                      <SetVariablePanel
                        variableName={variableName}
                        mode={mode}
                        inputValue={inputValue}
                        suggestions={knownVariableNames}
                        onChange={(next) => updateSetVariablesInput(panelNode.id, next)}
                      />
                    );
                  })() : panelNode.data.kind === "builtin:if" ? (
                    <ConditionPanel
                      value={((panelNode.data.inputs as Record<string, unknown>)?.condition ?? "") as string}
                      onChange={(v) => updateInput(panelNode.id, "condition", v)}
                    />
                  ) : Object.entries(panelAction.inputs ?? {}).map(([key, input]) => {
                    const inputDef = input as {
                      type: { title?: string; description?: string };
                      fieldType?: string;
                    };
                    const value = (
                      ((panelNode.data.inputs as Record<string, unknown>)?.[key] ?? "") as string
                    );
                    const isLinearTeamField =
                      key === "team_id" && LINEAR_KINDS.has(panelNode.data.kind as string);
                    return (
                      <div key={key}>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                          {inputDef.type?.title ?? key}
                        </label>
                        {inputDef.type?.description && (
                          <p className="text-[10px] text-zinc-400 mb-1">{inputDef.type.description}</p>
                        )}
                        {isLinearTeamField && linearTeams.length > 0 ? (
                          <select
                            value={value}
                            onChange={(e) => updateInput(panelNode.id, key, e.target.value)}
                            className="w-full text-xs border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                          >
                            <option value="">Select a team…</option>
                            {linearTeams.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.key})
                              </option>
                            ))}
                          </select>
                        ) : inputDef.fieldType === "textarea" ? (
                          <textarea
                            value={value}
                            onChange={(e) => updateInput(panelNode.id, key, e.target.value)}
                            onFocus={() => setFocusedInputKey(key)}
                            rows={3}
                            className="w-full text-xs border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 resize-none focus:outline-none focus:ring-1 focus:ring-zinc-400"
                          />
                        ) : (
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => updateInput(panelNode.id, key, e.target.value)}
                            onFocus={() => setFocusedInputKey(key)}
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



