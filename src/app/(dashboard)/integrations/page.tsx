"use client";

import { useEffect, useState, useCallback } from "react";
import Nango from "@nangohq/frontend";
import { useTeam } from "@/hooks/useTeam";
import { AVAILABLE_INTEGRATIONS, type NangoConnection } from "@/types/workflow";

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
        alert(`Failed to start connection: ${err.error ?? "Unknown error"}`);
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
          }
        },
      });

      connect.setSessionToken(sessionToken);
    } catch (err) {
      console.error("Nango connect error:", err);
    } finally {
      setConnectingId(null);
    }
  }

  async function disconnectIntegration(connection: NangoConnection) {
    if (!confirm("Disconnect this integration?")) return;
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
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
        Integrations
      </h1>
      <p className="text-sm text-zinc-500 mb-6">
        Connect your third-party apps to use them in workflow actions.
      </p>

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : (
        <div className="space-y-4">
          {AVAILABLE_INTEGRATIONS.map((integration) => {
            const connection = connections.find((c) => c.integration_id === integration.id);
            const isConnecting = connectingId === integration.id;
            return (
              <div
                key={integration.id}
                className="flex items-center gap-4 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900"
              >
                <span className="text-3xl">{integration.icon}</span>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {integration.name}
                  </h3>
                  <p className="text-xs text-zinc-500">{integration.description}</p>
                  <div className="flex gap-2 mt-1">
                    {integration.actions.map((a) => (
                      <span
                        key={a.kind}
                        className="text-[10px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500"
                      >
                        {a.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  {connection ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                        Connected
                      </span>
                      <button
                        onClick={() => disconnectIntegration(connection)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => connectIntegration(integration.id)}
                      disabled={isConnecting}
                      className="px-3 py-1.5 text-xs font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50"
                    >
                      {isConnecting ? "Opening…" : "Connect"}
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
