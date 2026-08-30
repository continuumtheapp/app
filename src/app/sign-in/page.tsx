import { Suspense } from "react";
import { SignInForm } from "@/components/sign-in-form";

export const metadata = { title: "Sign in · Continuum" };

export default function SignInPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-medium tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-ink-soft">
        To post a place or get in touch with a host.
      </p>
      <div className="mt-6">
        <Suspense fallback={<div className="card h-64 animate-pulse" />}>
          <SignInForm />
        </Suspense>
      </div>
    </div>
  );
}
