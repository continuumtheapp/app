import { timingSafeEqual } from "node:crypto";
import { handleUpdate, type TelegramUpdate } from "@/lib/bot";

/**
 * Telegram calls this with every update for the bot (set up by
 * scripts/telegram-setup.mjs). The secret header proves it's Telegram: the
 * URL is public, so anyone could post to it otherwise.
 */
export async function POST(request: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  const given = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!expected || given.length !== expected.length
      || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    await handleUpdate((await request.json()) as TelegramUpdate);
  } catch (error) {
    // Answer 200 anyway: otherwise Telegram retries the same update forever.
    console.error("Telegram update failed", error);
  }
  return Response.json({ ok: true });
}
