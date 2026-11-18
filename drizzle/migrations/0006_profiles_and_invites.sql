-- Profiles get a description; joining goes through personal invite links,
-- each new person approved by an admin.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "member_status" text NOT NULL DEFAULT 'pending';
--> statement-breakpoint
-- Everyone already here was in the group before invites existed.
UPDATE "users" SET "member_status" = 'member';
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "ck_users_member_status"
  CHECK ("member_status" IN ('pending', 'member', 'rejected'));
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invite_code" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_invite_code_unique" ON "users" ("invite_code");
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invited_by_id" text
  REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_invited_by" ON "users" ("invited_by_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_member_status" ON "users" ("member_status");
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "join_note" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "join_requested_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reviewed_by_id" text
  REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamptz;
