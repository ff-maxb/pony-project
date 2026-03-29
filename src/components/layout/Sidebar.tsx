"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Plug,
  LayoutTemplate,
  ScrollText,
  Settings,
  HelpCircle,
  BookOpen,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/workflows", label: "Dashboard", icon: LayoutDashboard },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/executions", label: "Execution Logs", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="relative z-10 flex h-full w-64 shrink-0 flex-col border-r border-zinc-200/70 bg-white/85 backdrop-blur">
      <div className="border-b border-zinc-200/80 px-3 py-3">
        <OrganizationSwitcher
          hidePersonal
          appearance={{
            elements: {
              rootBox: "w-full",
              organizationSwitcherTrigger:
                "w-full h-9 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 text-sm font-medium text-zinc-900 transition hover:border-zinc-300 hover:bg-zinc-50 shadow-none min-w-0",
              organizationSwitcherTriggerIcon: "text-zinc-400 ml-auto shrink-0",
              organizationPreviewTextContainer: "text-zinc-900 truncate",
              organizationPreviewSecondaryIdentifier: "text-zinc-400 text-xs truncate",
            },
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2.5 pt-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/workflows"
              ? pathname === "/workflows" || pathname.startsWith("/workflows/")
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                isActive
                  ? "border border-zinc-200 bg-zinc-900 text-white shadow-sm"
                  : "border border-transparent text-zinc-600 hover:border-zinc-200 hover:bg-white hover:text-zinc-900"
              }`}
            >
              <Icon size={16} strokeWidth={1.75} className={isActive ? "text-white" : "text-zinc-500"} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom links */}
      <div className="space-y-1 border-t border-zinc-200/80 p-2.5">
        <Link
          href="/support"
          className="flex items-center gap-2.5 rounded-lg border border-transparent px-3 py-2 text-sm text-zinc-500 transition hover:border-zinc-200 hover:bg-white hover:text-zinc-900"
        >
          <HelpCircle size={16} strokeWidth={1.75} />
          Support
        </Link>
        <Link
          href="/docs"
          className="flex items-center gap-2.5 rounded-lg border border-transparent px-3 py-2 text-sm text-zinc-500 transition hover:border-zinc-200 hover:bg-white hover:text-zinc-900"
        >
          <BookOpen size={16} strokeWidth={1.75} />
          Docs
        </Link>
          <div className="mt-1 flex items-center gap-2.5 rounded-lg border border-transparent px-3 py-2">
            <UserButton />
          </div>
      </div>
    </aside>
  );
}
