-- AddColumn: notificationPrefs on users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notificationPrefs" JSONB;
