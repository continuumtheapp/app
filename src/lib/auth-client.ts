"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // Telegram sign-in uses the built-in social flow; no client plugins needed.
});

export const { signIn, signOut, useSession } = authClient;
