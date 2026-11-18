-- Launch set agreed on 13 Nov 2026: ID check before publishing, the Fair Rent
-- Pledge on offers, and the bot's group posts (kept so they can be taken down).

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "id_check_status" text NOT NULL DEFAULT 'none';
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "ck_users_id_check_status"
  CHECK ("id_check_status" IN ('none', 'submitted', 'verified', 'rejected'));
--> statement-breakpoint
-- The ID photo and selfie, only while an admin hasn't looked at them yet.
-- Both are deleted from storage, and these set to null, once the check is done.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "id_doc_key" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "id_selfie_key" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "id_submitted_at" timestamptz;
--> statement-breakpoint
-- All that's kept after the check: when, and by which admin.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "id_checked_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "id_checked_by_id" text
  REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_id_check" ON "users" ("id_check_status");
--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "fair_rent_pledged_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "telegram_message_id" bigint;
--> statement-breakpoint
ALTER TABLE "housing_requests" ADD COLUMN IF NOT EXISTS "telegram_message_id" bigint;
