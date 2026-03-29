"use client";

import { useEffect, useState, useCallback } from "react";
import Nango from "@nangohq/frontend";
import { toast } from "sonner";
import { useTeam } from "@/hooks/useTeam";
import { AVAILABLE_INTEGRATIONS, type NangoConnection } from "@/types/workflow";
import {
  MessageSquare,
  Mail,
  Sheet,
  CircleDot,
  CalendarDays,
  Link2,
  CheckCircle2,
} from "lucide-react";

const integrationIconMap = {
  slack: MessageSquare,
  gmail: Mail,
  "google-sheets": Sheet,
  linear: CircleDot,
  calendly: CalendarDays,
} as const;

export default function IntegrationsPage() {
  const { activeTeam } = useTeam();
  const [connections, setConnections] = useState<NangoConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    if (!activeTeam) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/integrations?teamId=${activeTeam.id}`);
      if (res.ok) {
        const data = await res.json();
        setConnections(Array.isArray(data) ? data : (data.connections ?? []));
      }
    } finally {
      setLoading(false);
    }
  }, [activeTeam]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  async function connectIntegration(integrationId: string) {
    if (!activeTeam) return;
    setConnectingId(integrationId);
    try {
      // 1. Get a session token from our backend
      const tokenRes = await fetch("/api/nango/session-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: activeTeam.id, integrationId }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.json();
        toast.error(`Failed to start connection: ${err.error ?? "Unknown error"}`);
        return;
      }

      const { sessionToken } = await tokenRes.json();

      // 2. Open Nango Connect UI
      const nango = new Nango();
      const connect = nango.openConnectUI({
        onEvent: async (event) => {
          if (event.type === "connect") {
            // Save the connection directly (webhook won't fire on localhost)
            await fetch("/api/integrations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                teamId: activeTeam!.id,
                integrationId,
                nangoConnectionId: event.payload.connectionId,
              }),
            });
            await loadConnections();
            toast.success(`${integrationId} connected successfully`);
          }
        },
      });
      connect.setSessionToken(sessionToken);
    } finally {
      setConnectingId(null);
    }
  }

  async function disconnectIntegration(connection: NangoConnection) {
    if (!activeTeam) return;
    const res = await fetch(
      `/api/integrations?connectionId=${connection.id}&teamId=${activeTeam.id}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setConnections((prev) => prev.filter((c) => c.id !== connection.id));
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl landing-fade-up">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Integrations</h1>
        <p className="mt-1 text-sm text-zinc-500">Connect your tools once and use them across workflow actions.</p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-zinc-200/80 bg-white/85 px-5 py-8 text-sm text-zinc-500">
          Loading integrations...
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/90 shadow-[0_10px_28px_rgba(24,24,27,0.06)]">
          {AVAILABLE_INTEGRATIONS.map((integration) => {
            const Icon = integrationIconMap[integration.id as keyof typeof integrationIconMap] ?? Link2;
            const connection = connections.find((c) => c.integration_id === integration.id);
            const isConnecting = connectingId === integration.id;

            return (
              <div
                key={integration.id}
                className="flex flex-col gap-4 px-4 py-4 transition hover:bg-zinc-50/60 sm:px-5 lg:flex-row lg:items-center lg:gap-5"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-zinc-900">{integration.name}</h3>
                    <p className="text-xs text-zinc-500">{integration.description}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {integration.actions.map((a) => (
                        <span
                          key={a.kind}
                          className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[10px] font-medium text-zinc-600"
                        >
                          {a.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 lg:min-w-[220px] lg:justify-end">
                  {connection ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                      <CheckCircle2 size={12} />
                      Connected
                    </span>
                  ) : (
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-500">
                      Not connected
                    </span>
                  )}

                  {connection ? (
                    <button
                      onClick={() => disconnectIntegration(connection)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => connectIntegration(integration.id)}
                      disabled={isConnecting}
                      className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
                    >
                      {isConnecting ? "Opening..." : "Connect"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
