-- Add lastLoginAt and adminNotes to users
ALTER TABLE "users" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "adminNotes" TEXT;

-- Create points_history table
CREATE TABLE "points_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "points_history_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "points_history" ADD CONSTRAINT "points_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "points_history" ADD CONSTRAINT "points_history_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create index for faster queries
CREATE INDEX "points_history_userId_idx" ON "points_history"("userId");
CREATE INDEX "points_history_seasonId_idx" ON "points_history"("seasonId");
CREATE INDEX "points_history_createdAt_idx" ON "points_history"("createdAt");
