/**
 * Outbound email, behind a one-function interface.
 *
 * Calls Resend's REST API directly with fetch rather than using their SDK: the
 * SDK pulls in React-email rendering machinery we don't use, and this Worker
 * sits close enough to the free plan's 3 MiB bundle limit that it mattered.
 * Swapping providers means changing this file and nothing else.
 */
import { requireEnv } from "./env";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export async function sendMagicLinkEmail(to: string, url: string): Promise<void> {
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: requireEnv("EMAIL_FROM"),
      to,
      subject: "Your sign-in link",
      text: [
        "Here's your link to sign in to the Berlin housing board:",
        "",
        url,
        "",
        "It works once and expires in 24 hours.",
        "If you didn't ask for this, you can ignore this email.",
      ].join("\n"),
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;line-height:1.5">
          <p>Here's your link to sign in to the Berlin housing board:</p>
          <p style="margin:24px 0">
            <a href="${url}"
               style="background:#1a1a1a;color:#fff;padding:12px 20px;
                      border-radius:8px;text-decoration:none;display:inline-block">
              Sign in
            </a>
          </p>
          <p style="color:#666;font-size:14px">
            It works once and expires in 24 hours.<br>
            If you didn't ask for this, you can ignore this email.
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Could not send sign-in email (${response.status}): ${detail.slice(0, 200)}`);
  }
}
