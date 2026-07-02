'use client';

import { useState } from 'react';

/**
 * Standard action row shown under every Lightning invoice / LNURL QR code:
 *  - Open in Phoenix (phoenix:lightning:<code>) — works on iOS + Android
 *  - Open in another wallet (lightning:<code>)
 *  - Copy — always copies the raw BOLT11 invoice / LNURL text, never a URL.
 *
 * Users long-pressing the QR image on mobile end up copying the QR image URL
 * (api.qrserver.com/...), which wallets reject. This component gives them a
 * reliable copy button instead.
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

  return (
    <div className="flex flex-col gap-2 w-full max-w-xs mx-auto">
      <a
        href={`phoenix:lightning:${value}`}
        className="block text-center bg-orange-500 hover:bg-orange-600 text-black font-bold px-4 py-2.5 rounded-lg transition"
      >
        📱 Open in Phoenix
      </a>
      <a
        href={`lightning:${value}`}
        className="block text-center bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-2.5 rounded-lg transition"
      >
        ⚡ Open in Other Wallet
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
