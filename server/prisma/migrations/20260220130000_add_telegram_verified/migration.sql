-- AddColumn telegramVerified to profiles
ALTER TABLE "profiles" ADD COLUMN "telegramVerified" BOOLEAN NOT NULL DEFAULT false;
