'use client';

/**
 * AnnouncementBar — renders active announcements directly below the top nav.
 *
 * Behavior:
 *  - Fetches `/api/announcements` (already filtered to active items by the server).
 *  - If the rendered text fits inside the container, it stays still.
 *  - If it overflows, the track scrolls horizontally at a constant speed.
 *    Speed is pixels-per-second, so longer content takes longer (feels natural).
 *  - We render two copies of the content back-to-back and animate
 *    `translateX(0 → -50%)`, which yields a seamless infinite loop.
 *  - Re-measures on window resize.
 *  - Respects `prefers-reduced-motion` (handled in globals.css).
 *  - Renders nothing if there are zero active announcements (fail-quiet on API errors).
 */

import { useEffect, useRef, useState } from 'react';
import { announcementAPI, type PublicAnnouncement } from '@/lib/api';

const SCROLL_SPEED_PX_PER_SEC = 50;

export default function AnnouncementBar() {
  const [items, setItems] = useState<PublicAnnouncement[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLSpanElement | null>(null);
  const [scrolling, setScrolling] = useState(false);
  const [durationSec, setDurationSec] = useState(20);

  // Fetch once on mount. Fail quiet — a missing endpoint should not break the page.
  useEffect(() => {
    let cancelled = false;
    announcementAPI
      .list()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        // Swallow — announcements are decorative.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Measure content vs container to decide whether to scroll.
  useEffect(() => {
    if (items.length === 0) return;

    const measure = () => {
      const container = containerRef.current;
      const content = contentRef.current;
      if (!container || !content) return;
      // contentRef wraps ONE copy of the message run; track holds two copies.
      const contentWidth = content.scrollWidth;
      const containerWidth = container.clientWidth;
      if (contentWidth > containerWidth + 4) {
        setScrolling(true);
        setDurationSec(Math.max(8, contentWidth / SCROLL_SPEED_PX_PER_SEC));
      } else {
        setScrolling(false);
      }
    };

    measure();
    window.addEventListener('resize', measure);
    // Re-measure on next frame to catch font loading shifts.
    const raf = requestAnimationFrame(measure);
    return () => {
      window.removeEventListener('resize', measure);
      cancelAnimationFrame(raf);
    };
  }, [items]);

  if (items.length === 0) return null;

  // Build the message run. Separate items with a dot.
  const renderRun = (key: string) => (
    <span key={key} className="inline-flex items-center px-4">
      {items.map((item, idx) => (
        <span key={item.id} className="inline-flex items-center">
          {item.linkUrl ? (
            <a
              href={item.linkUrl}
              target={item.linkUrl.startsWith('http') ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {item.message}
            </a>
          ) : (
            <span>{item.message}</span>
          )}
          {idx < items.length - 1 && <span className="mx-6 text-white/40">•</span>}
        </span>
      ))}
    </span>
  );

  return (
    <div
      className="bg-yellow-500/15 border-b border-yellow-500/30 text-yellow-100 text-sm"
      role="region"
      aria-label="Announcements"
    >
      <div ref={containerRef} className="max-w-7xl mx-auto overflow-hidden py-2">
        {scrolling ? (
          <div
            className="marquee-track is-scrolling"
            style={{ animationDuration: `${durationSec}s` }}
          >
            {/* First copy is the one we measure */}
            <span ref={contentRef}>{renderRun('a')}</span>
            {/* Second copy: aria-hidden duplicate that produces the seamless loop */}
            <span aria-hidden="true">{renderRun('b')}</span>
          </div>
        ) : (
          <div className="marquee-track text-center w-full">
            <span ref={contentRef} className="px-4">
              {renderRun('a')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
