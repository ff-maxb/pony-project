"use client";

import { useAuth } from "@clerk/nextjs";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export function HeaderAuth() {
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return <UserButton />;
  }

  return (
    <>
      <SignInButton mode="redirect" forceRedirectUrl="/workflows">
        <button className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          Sign in
        </button>
      </SignInButton>
      <SignUpButton mode="redirect" forceRedirectUrl="/workflows">
        <button className="text-sm font-medium px-4 py-2 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors">
          Sign up
        </button>
      </SignUpButton>
    </>
  );
}
