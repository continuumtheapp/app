-- Two changes, both driven by how people actually use the board.
--
-- 1. Hosts commonly quote several rates — nightly for short stays, a cheaper
--    monthly one for long stays. One price with a period selector could not
--    express that, so each period now has its own optional column and search
--    picks whichever suits the requested stay.
--
-- 2. People are reachable on different apps. Instead of one method plus one
--    handle, a user may give a Telegram handle, a WhatsApp number, or both;
--    at least one is still required before posting.

-- --- prices --------------------------------------------------------------
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "price_night_cents" integer;
--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "price_week_cents" integer;
--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "price_month_cents" integer;
--> statement-breakpoint

-- Move each existing listing's single price into the column for its period.
UPDATE "listings" SET
  "price_night_cents" = CASE WHEN "price_period" = 'night' THEN "price_cents" END,
  "price_week_cents"  = CASE WHEN "price_period" = 'week'  THEN "price_cents" END,
  "price_month_cents" = CASE WHEN "price_period" = 'month' THEN "price_cents" END;
--> statement-breakpoint

ALTER TABLE "listings" DROP CONSTRAINT IF EXISTS "ck_listings_money";
--> statement-breakpoint
ALTER TABLE "listings" DROP COLUMN IF EXISTS "price_cents";
--> statement-breakpoint
ALTER TABLE "listings" DROP COLUMN IF EXISTS "price_period";
--> statement-breakpoint

ALTER TABLE "listings" ADD CONSTRAINT "ck_listings_money" CHECK (
  ("price_night_cents" IS NULL OR "price_night_cents" >= 0)
  AND ("price_week_cents" IS NULL OR "price_week_cents" >= 0)
  AND ("price_month_cents" IS NULL OR "price_month_cents" >= 0)
  AND "price_per_night_cents" >= 0 AND "deposit_cents" >= 0
);
--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "ck_listings_has_price" CHECK (
  "price_night_cents" IS NOT NULL
  OR "price_week_cents" IS NOT NULL
  OR "price_month_cents" IS NOT NULL
);
--> statement-breakpoint

-- --- contacts ------------------------------------------------------------
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_handle" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "whatsapp_number" text;
--> statement-breakpoint

UPDATE "users" SET
  "telegram_handle" = CASE WHEN "contact_method" = 'telegram' THEN "contact_handle" END,
  "whatsapp_number" = CASE WHEN "contact_method" = 'whatsapp' THEN "contact_handle" END;
--> statement-breakpoint

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "ck_users_contact_paired";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "contact_method";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "contact_handle";
--> statement-breakpoint

ALTER TABLE "users" ADD CONSTRAINT "ck_users_contact_nonempty" CHECK (
  ("telegram_handle" IS NULL OR length(trim("telegram_handle")) > 0)
  AND ("whatsapp_number" IS NULL OR length(trim("whatsapp_number")) > 0)
);
