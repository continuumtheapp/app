-- An optional note on a request (18 Nov 2026): why someone is coming, what
-- they'll be doing, anything a host should know. Their profile says who they are.

ALTER TABLE "housing_requests" ADD COLUMN IF NOT EXISTS "note" text;
