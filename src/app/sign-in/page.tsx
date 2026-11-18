import { Suspense } from "react";
import { SignInForm } from "@/components/sign-in-form";
import { isTelegramConfigured } from "@/lib/env";
import { DEV_TEST_MEMBERS, isDevSignInEnabled } from "@/lib/dev-sign-in";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in · SimbaCasa" };

export default function SignInPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-medium tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-ink-soft">
        To post a place or get in touch with a host.
      </p>
      <div className="mt-6">
        <Suspense fallback={<div className="card h-64 animate-pulse" />}>
          <SignInForm telegram={isTelegramConfigured()}
                      testMembers={isDevSignInEnabled() ? [...DEV_TEST_MEMBERS] : []} />
        </Suspense>
      </div>
    </div>
  );
}
