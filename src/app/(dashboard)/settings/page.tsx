"use client";

import { useEffect, useState } from "react";
import { useTeam } from "@/hooks/useTeam";
import type { TeamMember } from "@/types/workflow";

export default function SettingsPage() {
  const { activeTeam, teams, setActiveTeam } = useTeam();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [newTeamName, setNewTeamName] = useState("");

  useEffect(() => {
    if (!activeTeam) return;
    async function loadMembers() {
      setLoading(true);
      try {
        const res = await fetch(`/api/teams/${activeTeam!.id}/members`);
        if (res.ok) {
          const data = await res.json();
          setMembers(data.members ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    loadMembers();
  }, [activeTeam]);

  async function inviteMember(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTeam || !inviteEmail.trim()) return;
    await fetch(`/api/teams/${activeTeam.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: inviteEmail.trim(), role: "member" }),
    });
    setInviteEmail("");
    // Reload members
    const res = await fetch(`/api/teams/${activeTeam.id}/members`);
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members ?? []);
    }
  }

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTeamName.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setActiveTeam(data.team);
      setNewTeamName("");
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        Settings
      </h1>

      {/* Team Switcher */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
          Teams
        </h2>
        <div className="space-y-2 mb-4">
          {teams.map((team) => (
            <div
              key={team.id}
              className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                activeTeam?.id === team.id
                  ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800"
                  : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              }`}
              onClick={() => setActiveTeam(team)}
            >
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {team.name}
              </span>
              {activeTeam?.id === team.id && (
                <span className="text-xs text-zinc-500">Active</span>
              )}
            </div>
          ))}
        </div>
        <form onSubmit={createTeam} className="flex gap-2">
          <input
            type="text"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="New team name"
            className="input-field flex-1"
          />
          <button
            type="submit"
            className="px-3 py-2 text-sm font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-700 dark:hover:bg-zinc-300"
          >
            Create Team
          </button>
        </form>
      </section>

      {/* Team Members */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
          Members
          {activeTeam && (
            <span className="text-sm font-normal text-zinc-500 ml-2">
              ({activeTeam.name})
            </span>
          )}
        </h2>
        {loading ? (
          <p className="text-zinc-500 text-sm">Loading...</p>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 border border-zinc-200 dark:border-zinc-800 rounded-xl"
                >
                  <span className="text-sm font-mono text-zinc-700 dark:text-zinc-300">
                    {member.user_id}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 capitalize">
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
            <form onSubmit={inviteMember} className="flex gap-2">
              <input
                type="text"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="User ID to invite"
                className="input-field flex-1"
              />
              <button
                type="submit"
                className="px-3 py-2 text-sm font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-700 dark:hover:bg-zinc-300"
              >
                Invite
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
