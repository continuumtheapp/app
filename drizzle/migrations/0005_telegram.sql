-- Sign-in moves to Telegram. Each user is tied to their numeric Telegram ID,
-- which never changes; the @username is refreshed from Telegram on sign-in.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_id" bigint;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_telegram_id_unique" ON "users" ("telegram_id");
