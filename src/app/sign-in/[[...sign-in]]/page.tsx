import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex-1 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Sign in to your Pony account to manage your workflows
          </p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: "w-full",
              cardBox: "w-full shadow-none",
              card: "w-full shadow-none border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 p-0",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              socialButtonsBlockButton:
                "border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors",
              socialButtonsBlockButtonText: "font-medium text-sm",
              formButtonPrimary:
                "bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-700 dark:hover:bg-zinc-300 text-white dark:text-zinc-900 rounded-xl text-sm font-medium shadow-none",
              formFieldInput:
                "rounded-xl border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100",
              footerAction: "pt-4",
              footerActionLink:
                "text-zinc-900 dark:text-zinc-100 font-medium hover:text-zinc-600 dark:hover:text-zinc-400",
              dividerLine: "bg-zinc-200 dark:bg-zinc-800",
              dividerText: "text-zinc-400 text-xs",
              identityPreview: "rounded-xl border-zinc-200 dark:border-zinc-700",
              formFieldLabel: "text-zinc-600 dark:text-zinc-400 text-sm font-medium",
              internal: "shadow-none",
            },
          }}
        />
      </div>
    </div>
  );
}
