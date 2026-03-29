import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

export default async function Home() {
  const { userId } = await auth();
  if (userId) {
    redirect("/workflows");
  }

  return (
    <div className="landing-canvas min-h-screen bg-zinc-50 text-zinc-900">
      <div className="pointer-events-none absolute inset-0 landing-gradient" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/85 px-3 py-1.5 backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold tracking-wide text-zinc-600">PONY</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-900"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
          >
            Get started
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-6xl gap-8 px-5 pb-14 pt-4 sm:px-8 lg:pt-10">
        <section className="space-y-6">
          <div className="landing-fade-up" style={{ animationDelay: "100ms" }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600">
              Builder-grade workflow automation
            </span>
          </div>

          <div className="space-y-4 landing-fade-up" style={{ animationDelay: "180ms" }}>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl">
              Clean canvas.
              <br />
              Powerful automation.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-zinc-600 sm:text-lg">
              Build no-code flows that look and feel like your workflow editor: precise, minimal, and easy to reason about.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 landing-fade-up" style={{ animationDelay: "260ms" }}>
            <Link
              href="/sign-up"
              className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700"
            >
              Start building
            </Link>
            <Link
              href="/sign-in"
              className="rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-900"
            >
              Open dashboard
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
