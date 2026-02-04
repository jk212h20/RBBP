-- CreateTable
CREATE TABLE "deleted_users" (
    "id" TEXT NOT NULL,
    "originalId" TEXT NOT NULL,
    "userData" JSONB NOT NULL,
    "deletedBy" TEXT NOT NULL,
    "reason" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deleted_users_pkey" PRIMARY KEY ("id")
);
