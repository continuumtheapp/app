-- better-auth 1.7 added an "issuer" field to its account model. Without the
-- column, every social sign-in fails with:
--   The field "issuer" does not exist in the schema for the model "account"
--
-- Defaulted to '' so existing rows (there are none yet) stay valid.

ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "issuer" text NOT NULL DEFAULT '';
