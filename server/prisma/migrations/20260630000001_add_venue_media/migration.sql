-- Add tagged venue media/images for venue photos and menu pages
CREATE TABLE "venue_media" (
  "id" TEXT NOT NULL,
  "venueId" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "caption" TEXT,
  "isMenu" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "venue_media_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "venue_media_venueId_isMenu_idx" ON "venue_media"("venueId", "isMenu");

ALTER TABLE "venue_media" ADD CONSTRAINT "venue_media_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
