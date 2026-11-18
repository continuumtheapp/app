-- Joining no longer asks how you know the inviter: the invite link already
-- records who vouched for you, and the request is just your profile.
ALTER TABLE "users" DROP COLUMN IF EXISTS "join_note";
