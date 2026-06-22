import { Page } from '@playwright/test';

export interface OverflowReport {
  hasHorizontalOverflow: boolean;
  documentScrollWidth: number;
  viewportWidth: number;
  offenders: { selector: string; right: number; width: number; text: string }[];
}

/**
 * Detect horizontal overflow (the #1 mobile bug: content wider than the screen,
 * causing a sideways scroll / zoomed-out feel). We also collect the specific
 * elements that extend past the viewport so failures are actionable.
 */
export async function checkHorizontalOverflow(page: Page): Promise<OverflowReport> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const docScrollWidth = document.documentElement.scrollWidth;
    const offenders: { selector: string; right: number; width: number; text: string }[] = [];

    const all = Array.from(document.body.querySelectorAll<HTMLElement>('*'));
    for (const el of all) {
      const r = el.getBoundingClientRect();
      // Ignore zero-size / hidden / fixed full-bleed backgrounds.
      if (r.width === 0 || r.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      // Allow a 2px fudge for sub-pixel rounding.
      if (r.right > vw + 2 || r.width > vw + 2) {
        // Build a short selector
        const id = el.id ? `#${el.id}` : '';
        const cls = el.className && typeof el.className === 'string'
          ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
          : '';
        offenders.push({
          selector: `${el.tagName.toLowerCase()}${id}${cls}`,
          right: Math.round(r.right),
          width: Math.round(r.width),
          text: (el.innerText || '').slice(0, 40).replace(/\s+/g, ' ').trim(),
        });
      }
    }
    // De-dup similar offenders, keep widest few.
    const top = offenders
      .sort((a, b) => b.right - a.right)
      .slice(0, 12);

    return {
      hasHorizontalOverflow: docScrollWidth > vw + 2,
      documentScrollWidth: docScrollWidth,
      viewportWidth: vw,
      offenders: top,
    };
  });
}

export interface TapTargetReport {
  total: number;
  tooSmall: { selector: string; w: number; h: number; text: string }[];
}

const MIN_TAP = 40; // px; Apple HIG ~44, Google ~48. 40 is a lenient floor.

/**
 * Flag interactive elements (links, buttons, inputs) that are smaller than a
 * comfortable touch target. Only considers on-screen, visible elements.
 */
export async function checkTapTargets(page: Page): Promise<TapTargetReport> {
  return page.evaluate((MIN_TAP) => {
    const sels = 'a[href], button, [role="button"], input:not([type="hidden"]), select, textarea';
    const els = Array.from(document.querySelectorAll<HTMLElement>(sels));
    const tooSmall: { selector: string; w: number; h: number; text: string }[] = [];
    let total = 0;
    for (const el of els) {
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // Skip elements scrolled out of view vertically far away (still count in-page).
      total++;
      // An element passes if EITHER dimension chain reaches min via padding.
      if (r.width < MIN_TAP || r.height < MIN_TAP) {
        const id = el.id ? `#${el.id}` : '';
        const cls = el.className && typeof el.className === 'string'
          ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
          : '';
        tooSmall.push({
          selector: `${el.tagName.toLowerCase()}${id}${cls}`,
          w: Math.round(r.width),
          h: Math.round(r.height),
          text: (el.innerText || el.getAttribute('aria-label') || '').slice(0, 30).replace(/\s+/g, ' ').trim(),
        });
      }
    }
    return { total, tooSmall };
  }, MIN_TAP);
}

export interface InputZoomReport {
  total: number;
  tooSmall: { selector: string; fontSize: number; type: string }[];
}

/**
 * iOS Safari zooms the page when focusing an input whose font-size is < 16px.
 * This is jarring on mobile. Flag any text-entry inputs below 16px.
 */
export async function checkInputFontSizes(page: Page): Promise<InputZoomReport> {
  return page.evaluate(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea, select')
    );
    const tooSmall: { selector: string; fontSize: number; type: string }[] = [];
    let total = 0;
    for (const el of els) {
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      total++;
      const fs = parseFloat(style.fontSize);
      if (fs < 16) {
        const id = el.id ? `#${el.id}` : '';
        const name = (el as HTMLInputElement).name ? `[name=${(el as HTMLInputElement).name}]` : '';
        tooSmall.push({
          selector: `${el.tagName.toLowerCase()}${id}${name}`,
          fontSize: fs,
          type: (el as HTMLInputElement).type || el.tagName.toLowerCase(),
        });
      }
    }
    return { total, tooSmall };
  });
}

export interface ViewportMetaReport {
  hasViewportMeta: boolean;
  content: string | null;
  viewportFitCover: boolean;
  hasThemeColor: boolean;
  hasManifest: boolean;
  hasAppleTouchIcon: boolean;
  hasAppleWebAppCapable: boolean;
}

/** Inspect <head> for mobile/PWA readiness. */
export async function checkViewportAndPwa(page: Page): Promise<ViewportMetaReport> {
  return page.evaluate(() => {
    const vp = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    const content = vp?.content ?? null;
    return {
      hasViewportMeta: !!vp,
      content,
      viewportFitCover: !!content && /viewport-fit\s*=\s*cover/.test(content),
      hasThemeColor: !!document.querySelector('meta[name="theme-color"]'),
      hasManifest: !!document.querySelector('link[rel="manifest"]'),
      hasAppleTouchIcon: !!document.querySelector('link[rel="apple-touch-icon"]'),
      hasAppleWebAppCapable: !!document.querySelector(
        'meta[name="apple-mobile-web-app-capable"], meta[name="mobile-web-app-capable"]'
      ),
    };
  });
}

export interface TinyTextReport {
  count: number;
  samples: { selector: string; fontSize: number; text: string }[];
}

/**
 * Flag *primary* body text rendered below ~12px. We sample text-bearing leaf
 * elements; tiny metadata labels are common, so this is informational.
 */
export async function checkTinyText(page: Page): Promise<TinyTextReport> {
  return page.evaluate(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('p, span, li, td, a, div'));
    const samples: { selector: string; fontSize: number; text: string }[] = [];
    let count = 0;
    for (const el of els) {
      // leaf-ish: has its own text, not just children
      const ownText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent || '')
        .join('')
        .trim();
      if (ownText.length < 4) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const fs = parseFloat(style.fontSize);
      if (fs > 0 && fs < 12) {
        count++;
        if (samples.length < 10) {
          samples.push({
            selector: el.tagName.toLowerCase(),
            fontSize: fs,
            text: ownText.slice(0, 40),
          });
        }
      }
    }
    return { count, samples };
  });
}

export interface LayoutSanityReport {
  viewport: { w: number; h: number };
  // Content jammed against the very edge of the screen (no breathing room).
  edgeTouching: { selector: string; side: string; gap: number; text: string }[];
  // Two interactive elements whose hit-boxes overlap (mis-tap risk).
  overlappingTargets: { a: string; b: string; overlap: number }[];
  // Interactive elements closer than 8px to a neighbour (crowded).
  crowdedTargets: { a: string; b: string; gap: number }[];
  // <img> that failed to load or rendered at a wildly wrong aspect ratio.
  brokenImages: { src: string; natural: string; rendered: string; reason: string }[];
  // Text visually cut off. kind: 'accidental' (bug) | 'intentional' (clamp/truncate).
  clippedText: { selector: string; text: string; kind: 'accidental' | 'intentional' }[];
  // Elements rendered partially or fully off the top/left (negative coords).
  offScreen: { selector: string; left: number; top: number; text: string }[];
  // Containers far wider than their content centred awkwardly is fine; this
  // flags elements that are *empty* but take large vertical space (layout gaps).
  emptyBigBlocks: { selector: string; h: number }[];
}

/**
 * Logical, measured "does this look wrong?" checks — no eyeballing required.
 * Everything here is derived from real geometry in the rendered mobile browser.
 */
export async function checkLayoutSanity(page: Page): Promise<LayoutSanityReport> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;

    const shortSel = (el: Element) => {
      const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : '';
      const cn = (el as HTMLElement).className;
      const cls = cn && typeof cn === 'string'
        ? '.' + cn.trim().split(/\s+/).slice(0, 2).join('.')
        : '';
      return `${el.tagName.toLowerCase()}${id}${cls}`;
    };
    const visible = (el: Element) => {
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none' || parseFloat(s.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const txt = (el: Element) => ((el as HTMLElement).innerText || '').slice(0, 40).replace(/\s+/g, ' ').trim();

    // ---- 1. Edge-touching meaningful content ----
    // We only care about text/image/button content (not full-bleed bg layers).
    const edgeTouching: any[] = [];
    const contentSel = 'h1,h2,h3,h4,p,span,a,button,img,li,input,label';
    for (const el of Array.from(document.querySelectorAll(contentSel))) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      // skip elements designed to be full width (close to 100vw)
      if (r.width >= vw - 1) continue;
      if (r.left < 1) edgeTouching.push({ selector: shortSel(el), side: 'left', gap: Math.round(r.left), text: txt(el) });
      else if (r.right > vw - 1) edgeTouching.push({ selector: shortSel(el), side: 'right', gap: Math.round(vw - r.right), text: txt(el) });
    }

    // ---- 2 & 3. Overlapping / crowded interactive elements ----
    const interactive = Array.from(
      document.querySelectorAll('a[href],button,[role="button"],input:not([type="hidden"]),select')
    ).filter(visible);
    const rects = interactive.map((el) => ({ el, r: el.getBoundingClientRect() }));
    const overlappingTargets: any[] = [];
    const crowdedTargets: any[] = [];
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const A = rects[i], B = rects[j];
        // skip if one contains the other (nested anchor/button is fine)
        if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
        const ox = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left);
        const oy = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
        if (ox > 2 && oy > 2) {
          overlappingTargets.push({ a: shortSel(A.el), b: shortSel(B.el), overlap: Math.round(Math.min(ox, oy)) });
        } else if (oy > 8) {
          // horizontally adjacent within the same vertical band; flag only if
          // the horizontal gap is uncomfortably small (<6px) AND both are real
          // content buttons (ignore logo+hamburger header pairing which sits at
          // opposite ends with layout spacing between).
          const gap = Math.round(Math.max(0, -ox));
          const adjacent = -ox < 6 && -ox > -40; // genuinely near each other
          if (adjacent && gap < 6) {
            crowdedTargets.push({ a: shortSel(A.el), b: shortSel(B.el), gap });
          }
        }
      }
    }

    // ---- 4. Broken / mis-sized images ----
    const brokenImages: any[] = [];
    for (const img of Array.from(document.querySelectorAll('img'))) {
      if (!visible(img)) continue;
      const nat = `${img.naturalWidth}x${img.naturalHeight}`;
      const r = img.getBoundingClientRect();
      const ren = `${Math.round(r.width)}x${Math.round(r.height)}`;
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        brokenImages.push({ src: img.currentSrc || img.src, natural: nat, rendered: ren, reason: 'failed-to-load' });
        continue;
      }
      const natAR = img.naturalWidth / img.naturalHeight;
      const renAR = r.width / r.height;
      // Flag severe distortion (>35% aspect-ratio deviation) unless object-fit handles it.
      const fit = getComputedStyle(img).objectFit;
      if (fit !== 'cover' && fit !== 'contain' && Math.abs(renAR - natAR) / natAR > 0.35) {
        brokenImages.push({ src: img.currentSrc || img.src, natural: nat, rendered: ren, reason: 'distorted-aspect' });
      }
    }

    // ---- 5. Text clipped by overflow:hidden ancestor ----
    // Distinguish INTENTIONAL clamp/truncate (a design choice -> informational)
    // from ACCIDENTAL clipping (content cut off with no ellipsis/clamp -> bug).
    const clippedText: any[] = [];
    for (const el of Array.from(document.querySelectorAll('h1,h2,h3,p,span,a,li,td,button'))) {
      if (!visible(el)) continue;
      const he = el as HTMLElement;
      const s = getComputedStyle(he);
      const ellipsis = s.textOverflow === 'ellipsis';
      const lineClamp = (s as any).webkitLineClamp && (s as any).webkitLineClamp !== 'none';
      const intentional = ellipsis || lineClamp;
      const hTrunc = he.scrollWidth > he.clientWidth + 2;
      const vClip = (s.overflowY === 'hidden' || s.overflow === 'hidden') && he.scrollHeight > he.clientHeight + 4 && he.clientHeight > 0;
      if (hTrunc || vClip) {
        clippedText.push({
          selector: shortSel(el),
          text: txt(el),
          // accidental = real bug; intentional = informational
          kind: intentional ? 'intentional' : 'accidental',
        });
      }
    }

    // ---- 6. Off-screen (negative) content ----
    const offScreen: any[] = [];
    for (const el of Array.from(document.querySelectorAll(contentSel))) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right < 1 || r.bottom < 1 || r.left < -2 || r.top < -200) {
        // r.top<-200 allows normal scroll; only flag clearly mis-placed
        if (r.left < -2 || r.right < 1) {
          offScreen.push({ selector: shortSel(el), left: Math.round(r.left), top: Math.round(r.top), text: txt(el) });
        }
      }
    }

    // ---- 7. Empty big blocks (layout gaps) ----
    const emptyBigBlocks: any[] = [];
    for (const el of Array.from(document.querySelectorAll('div,section'))) {
      if (!visible(el)) continue;
      const he = el as HTMLElement;
      const r = he.getBoundingClientRect();
      if (r.height > 120 && he.children.length === 0 && (he.innerText || '').trim().length === 0) {
        // ignore intentional spacers with a background image
        const bg = getComputedStyle(he).backgroundImage;
        if (bg === 'none') emptyBigBlocks.push({ selector: shortSel(el), h: Math.round(r.height) });
      }
    }

    return {
      viewport: { w: vw, h: vh },
      edgeTouching: edgeTouching.slice(0, 15),
      overlappingTargets: overlappingTargets.slice(0, 15),
      crowdedTargets: crowdedTargets.slice(0, 15),
      brokenImages: brokenImages.slice(0, 15),
      clippedText: clippedText.slice(0, 15),
      offScreen: offScreen.slice(0, 15),
      emptyBigBlocks: emptyBigBlocks.slice(0, 10),
    };
  });
}

/** Stabilise the page before screenshotting: stop animations, settle layout. */
export async function stabilize(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important;scroll-behavior:auto!important}`,
  });
  // Let fonts/images settle.
  await page.evaluate(() => (document as any).fonts?.ready).catch(() => {});
  await page.waitForTimeout(400);
}
