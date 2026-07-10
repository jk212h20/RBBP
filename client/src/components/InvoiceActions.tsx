'use client';

import { useEffect, useState } from 'react';

function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  if (/Android|iPhone|iPod/i.test(ua)) return true;
  // iPadOS 13+ reports as MacIntel but has touch support
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

/**
 * Standard action controls shown under every Lightning invoice / LNURL QR code.
 *
 * Mobile-first: on a phone the user can't scan the QR they're looking at, so
 * the design assumes and encourages ONE action — a single big button that
 * opens the invoice directly in Phoenix. Copy is secondary.
 *
 * Desktop: QR scanning is available; Phoenix and copy are compact fallbacks.
 */
export default function InvoiceActions({
  value,
  copyLabel = 'Copy Invoice',
}: {
  /** Raw BOLT11 payment request or LNURL string (no lightning: prefix). */
  value: string;
  copyLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older mobile browsers / non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // give up quietly; the invoice text is still selectable in most views
      }
      document.body.removeChild(ta);
    }
  };

  if (!value) return null;

  if (isMobile) {
    return (
      <div className="flex flex-col gap-2 w-full max-w-xs mx-auto">
        {/* THE button — one tap opens the invoice in Phoenix */}
        <a
          href={`phoenix:lightning:${value}`}
          className="block text-center bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-extrabold text-lg px-6 py-4 rounded-xl shadow-lg shadow-orange-900/40 transition active:scale-[0.98]"
        >
          ⚡ Pay with Phoenix
        </a>
        <button type="button" onClick={copy} className="text-blue-300 hover:text-blue-200 underline underline-offset-2 text-sm">
          {copied ? '✅ Copied!' : copyLabel}
        </button>
      </div>
    );
  }

  // Desktop: scanning the QR is available; Phoenix/copy are fallbacks below.
  return (
    <div className="flex flex-col gap-2 w-full max-w-xs mx-auto">
      <a
        href={`phoenix:lightning:${value}`}
        className="block text-center bg-orange-500 hover:bg-orange-600 text-black font-bold px-4 py-2.5 rounded-lg transition"
      >
        📱 Open in Phoenix
      </a>
      <button
        type="button"
        onClick={copy}
        className="block w-full bg-white/10 hover:bg-white/20 text-white font-semibold px-4 py-2.5 rounded-lg transition border border-white/20"
      >
        {copied ? '✅ Copied!' : `📋 ${copyLabel}`}
      </button>
    </div>
  );
}
