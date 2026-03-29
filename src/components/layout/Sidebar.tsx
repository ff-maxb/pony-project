"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OrganizationSwitcher } from "@clerk/nextjs";
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
    <aside className="w-56 shrink-0 bg-white border-r border-zinc-200 flex flex-col h-full">
      {/* Workspace switcher */}
      <div className="px-3 py-3 border-b border-zinc-100">
        <OrganizationSwitcher
          hidePersonal
          appearance={{
            elements: {
              rootBox: "w-full",
              organizationSwitcherTrigger:
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium text-zinc-900 hover:bg-zinc-50 transition-colors border-0 shadow-none bg-transparent",
              organizationSwitcherTriggerIcon: "text-zinc-400 ml-auto",
              organizationPreviewTextContainer: "text-zinc-900",
              organizationPreviewSecondaryIdentifier: "text-zinc-400 text-xs",
            },
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5 pt-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/workflows"
              ? pathname === "/workflows" || pathname.startsWith("/workflows/")
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-zinc-100 text-zinc-900 font-medium"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom links */}
      <div className="p-2 border-t border-zinc-100 space-y-0.5">
        <Link
          href="/support"
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
        >
          <HelpCircle size={16} strokeWidth={1.75} />
          Support
        </Link>
        <Link
          href="/docs"
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
        >
          <BookOpen size={16} strokeWidth={1.75} />
          Docs
        </Link>
      </div>
    </aside>
  );
}
