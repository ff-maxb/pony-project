import Sidebar from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="landing-canvas relative flex h-screen bg-zinc-50 text-zinc-900">
      <div className="pointer-events-none absolute inset-0 landing-gradient opacity-80" />
      <Sidebar />
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 min-h-0 overflow-auto px-6 pb-6 sm:px-8 sm:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
