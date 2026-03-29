import { UserButton } from "@clerk/nextjs";
import Sidebar from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-zinc-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex justify-end px-6 py-3 bg-zinc-50">
          <UserButton />
        </div>
        <main className="flex-1 overflow-auto px-8 pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
