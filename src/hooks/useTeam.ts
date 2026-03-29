"use client";

import { useEffect, useState, useCallback } from "react";
import type { Team } from "@/types/workflow";

/**
 * Hook to manage teams and the active team.
 * Auto-creates a default team if none exists.
 */
export function useTeam() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeam, setActiveTeamState] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTeams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/teams");
      if (!res.ok) return;
      const data = await res.json();
      const teamsList: Team[] = data.teams ?? data;
      setTeams(teamsList);

      if (teamsList.length > 0) {
        const stored = typeof window !== "undefined" ? localStorage.getItem("pony_team_id") : null;
        const found = teamsList.find((t) => t.id === stored);
        setActiveTeamState(found ?? teamsList[0]);
      } else {
        // Auto-create default team
        const createRes = await fetch("/api/teams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "My Team" }),
        });
        if (createRes.ok) {
          const created = await createRes.json();
          const team: Team = created.team ?? created;
          setTeams([team]);
          setActiveTeamState(team);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  useEffect(() => {
    if (activeTeam && typeof window !== "undefined") {
      localStorage.setItem("pony_team_id", activeTeam.id);
    }
  }, [activeTeam]);

  function setActiveTeam(team: Team) {
    setActiveTeamState(team);
  }

  return { teams, activeTeam, setActiveTeam, loading };
}
