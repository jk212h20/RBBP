-- Blog posts: admin-authored content shown on the home page and a public blog index.
CREATE TABLE "blog_posts" (
    "id"          TEXT NOT NULL,
    "slug"        TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "excerpt"     TEXT,
    "content"     TEXT NOT NULL,
    "coverImage"  TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");
CREATE INDEX "blog_posts_isPublished_publishedAt_idx" ON "blog_posts"("isPublished", "publishedAt");

-- Announcements: short messages shown in the top-bar marquee.
CREATE TABLE "announcements" (
    "id"        TEXT NOT NULL,
    "message"   TEXT NOT NULL,
    "linkUrl"   TEXT,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "announcements_isActive_sortOrder_idx" ON "announcements"("isActive", "sortOrder");
