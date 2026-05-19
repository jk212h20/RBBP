'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import MobileNav from '@/components/MobileNav';
import { useAuth } from '@/context/AuthContext';
import { balanceAPI, storeAPI, type StoreProduct } from '@/lib/api';

export default function StorePage() {
  const { isAuthenticated } = useAuth();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promo, setPromo] = useState<{ code: string; priceSats: number; usesRemaining: number } | null>(null);
  const [balanceSats, setBalanceSats] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingPromo, setCheckingPromo] = useState(false);
  const [buying, setBuying] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutData, setCheckoutData] = useState<{
    orderId: string;
    paymentRequest: string;
    qrData: string;
    lightningUri: string;
    expiresAt: string;
    pricePaidSats: number;
    size: string;
  } | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState<'idle' | 'pending' | 'paid' | 'expired' | 'failed'>('idle');
  const [checkoutCountdown, setCheckoutCountdown] = useState('');
  const [copiedInvoice, setCopiedInvoice] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const product = products[0];
  const selectedVariant = product?.variants.find(v => v.id === selectedVariantId);
  const finalPrice = promo?.priceSats || product?.priceSats || 0;

  const totalInventory = useMemo(
    () => product?.variants.reduce((sum, variant) => sum + variant.quantityAvailable, 0) || 0,
    [product]
  );

  useEffect(() => {
    loadStore();
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadBalance();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!checkoutData || checkoutStatus !== 'pending') return;

    const updateCountdown = () => {
      const msRemaining = new Date(checkoutData.expiresAt).getTime() - Date.now();
      if (msRemaining <= 0) {
        setCheckoutCountdown('expired');
        return;
      }
      const minutes = Math.floor(msRemaining / 60000);
      const seconds = Math.floor((msRemaining % 60000) / 1000);
      setCheckoutCountdown(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [checkoutData, checkoutStatus]);

  useEffect(() => {
    if (!checkoutData || checkoutStatus !== 'pending') return;

    const interval = setInterval(async () => {
      try {
        const result = await storeAPI.getOrderStatus(checkoutData.orderId);
        if (result.order.status === 'PAID' || result.order.status === 'FULFILLED') {
          setCheckoutStatus('paid');
          setMessage(`Order paid! Your ${checkoutData.size} shirt order is confirmed.`);
          await loadStore();
          await loadBalance();
        } else if (result.order.status === 'EXPIRED') {
          setCheckoutStatus('expired');
        } else if (result.order.status === 'FAILED' || result.order.status === 'CANCELLED') {
          setCheckoutStatus('failed');
        }
      } catch (err) {
        console.error('Failed to poll checkout status:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [checkoutData, checkoutStatus]);

  const loadStore = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await storeAPI.getStorefront();
      setProducts(data.products);
      const firstAvailable = data.products[0]?.variants.find(v => !v.soldOut && v.quantityAvailable > 0);
      if (firstAvailable) setSelectedVariantId(firstAvailable.id);
    } catch (err: any) {
      setError(err.message || 'Failed to load store');
    } finally {
      setLoading(false);
    }
  };

  const loadBalance = async () => {
    try {
      const data = await balanceAPI.get();
      setBalanceSats(data.balanceSats);
    } catch (err) {
      // Keep storefront public even if balance load fails.
    }
  };

  const resetCheckout = () => {
    setCheckoutData(null);
    setCheckoutStatus('idle');
    setCheckoutCountdown('');
    setCopiedInvoice(false);
  };

  const applyPromo = async () => {
    if (!product || !promoCode.trim()) return;
    setCheckingPromo(true);
    setError('');
    setMessage('');
    resetCheckout();
    try {
      const data = await storeAPI.previewPromo(product.id, promoCode);
      setPromo(data.promo);
      if (data.promo) {
        setMessage(`Promo applied: ${data.promo.priceSats.toLocaleString()} sats (${data.promo.usesRemaining} uses left)`);
      }
    } catch (err: any) {
      setPromo(null);
      setError(err.message || 'Invalid promo code');
    } finally {
      setCheckingPromo(false);
    }
  };

  const buyShirt = async () => {
    if (!product || !selectedVariant) return;
    setBuying(true);
    setError('');
    setMessage('');
    resetCheckout();
    try {
      const result = await storeAPI.createOrder({
        productId: product.id,
        variantId: selectedVariant.id,
        promoCode: promoCode.trim() || undefined,
      });
      setBalanceSats(result.balanceSats);
      setMessage(`Order placed! You bought a ${selectedVariant.size} shirt for ${result.order.pricePaidSats.toLocaleString()} sats.`);
      setPromo(null);
      await loadStore();
    } catch (err: any) {
      setError(err.message || 'Failed to place order');
    } finally {
      setBuying(false);
    }
  };

  const checkoutWithLightning = async () => {
    if (!product || !selectedVariant) return;
    setCheckingOut(true);
    setError('');
    setMessage('');
    resetCheckout();
    try {
      const result = await storeAPI.createLightningCheckout({
        productId: product.id,
        variantId: selectedVariant.id,
        promoCode: promoCode.trim() || undefined,
      });
      setCheckoutData({
        orderId: result.order.id,
        paymentRequest: result.paymentRequest,
        qrData: result.qrData,
        lightningUri: result.lightningUri,
        expiresAt: result.expiresAt,
        pricePaidSats: result.order.pricePaidSats,
        size: result.order.variant?.size || selectedVariant.size,
      });
      setCheckoutStatus('pending');
    } catch (err: any) {
      setError(err.message || 'Failed to create Lightning invoice');
    } finally {
      setCheckingOut(false);
    }
  };

  const copyInvoice = async () => {
    if (!checkoutData) return;
    try {
      await navigator.clipboard.writeText(checkoutData.paymentRequest);
      setCopiedInvoice(true);
      setTimeout(() => setCopiedInvoice(false), 2000);
    } catch (err) {
      setError('Could not copy invoice. Select and copy it manually.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-green-800">
      <MobileNav currentPage="store" />

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">👕</div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">RBBP Store</h1>
          <p className="text-blue-100 max-w-2xl mx-auto">
            Buy league gear with your site balance, or check out directly with a Lightning invoice.
          </p>
        </div>

        {message && <div className="mb-6 bg-green-500/20 border border-green-400 text-green-100 rounded-xl p-4">{message}</div>}
        {error && <div className="mb-6 bg-red-500/20 border border-red-400 text-red-100 rounded-xl p-4">{error}</div>}

        {loading ? (
          <div className="text-white text-center py-12">Loading store...</div>
        ) : !product ? (
          <div className="bg-white/10 rounded-2xl p-8 text-white text-center">No store items are available yet.</div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_420px] gap-6">
            <section className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-6 md:p-8 text-white">
              <div className="aspect-video bg-black/20 rounded-2xl flex items-center justify-center mb-6 border border-white/10">
                <div className="text-center">
                  <div className="text-8xl mb-3">👕</div>
                  <p className="text-blue-100">Official RBBP Shirt</p>
                </div>
              </div>
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-3xl font-bold">{product.name}</h2>
                  <p className="text-blue-100 mt-2 whitespace-pre-wrap">{product.description}</p>
                </div>
                <div className="text-right shrink-0">
                  {promo && <p className="text-sm text-green-300 line-through">{product.priceSats.toLocaleString()} sats</p>}
                  <p className="text-3xl font-bold text-yellow-300">{finalPrice.toLocaleString()} sats</p>
                </div>
              </div>
              <p className="text-sm text-blue-200">Inventory available: {totalInventory} shirts</p>
            </section>

            <aside className="bg-gray-950/70 backdrop-blur rounded-2xl border border-yellow-400/30 p-6 text-white h-fit">
              <h3 className="text-xl font-bold mb-4">Choose your shirt</h3>

              <label className="block text-sm text-yellow-100 mb-2">Size</label>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {product.variants.map(variant => (
                  <button
                    key={variant.id}
                    onClick={() => {
                      setSelectedVariantId(variant.id);
                      resetCheckout();
                    }}
                    disabled={variant.quantityAvailable <= 0}
                    className={`p-3 rounded-lg border text-left transition ${
                      selectedVariantId === variant.id
                        ? 'bg-yellow-400 text-black border-yellow-300'
                        : 'bg-white/10 border-white/20 hover:bg-white/20'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    <div className="font-bold">{variant.size}</div>
                    <div className="text-xs">{variant.quantityAvailable > 0 ? `${variant.quantityAvailable} left` : 'Sold out'}</div>
                  </button>
                ))}
              </div>

              <label className="block text-sm text-yellow-100 mb-2">Promo code</label>
              <div className="flex gap-2 mb-2">
                <input
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value);
                    setPromo(null);
                    resetCheckout();
                  }}
                  placeholder="Optional"
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400"
                />
                <button
                  onClick={applyPromo}
                  disabled={checkingPromo || !promoCode.trim()}
                  className="bg-white/10 hover:bg-white/20 disabled:opacity-50 px-4 py-2 rounded-lg font-semibold"
                >
                  {checkingPromo ? '...' : 'Apply'}
                </button>
              </div>
              {promo && <p className="text-green-300 text-sm mb-4">Promo price unlocked: {promo.priceSats.toLocaleString()} sats</p>}

              <div className="border-t border-white/10 pt-4 mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-300">Price</span>
                  <span className="font-bold">{finalPrice.toLocaleString()} sats</span>
                </div>
                {isAuthenticated && balanceSats !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-300">Your balance</span>
                    <span className={balanceSats >= finalPrice ? 'text-green-300' : 'text-red-300'}>{balanceSats.toLocaleString()} sats</span>
                  </div>
                )}
              </div>

              {checkoutStatus === 'pending' && checkoutData ? (
                <div className="mt-5 p-4 bg-black/30 rounded-xl border border-yellow-400/30 text-center">
                  <h4 className="font-bold text-yellow-200 mb-1">Lightning checkout</h4>
                  <p className="text-sm text-gray-300 mb-2">Pay {checkoutData.pricePaidSats.toLocaleString()} sats for a {checkoutData.size} shirt</p>
                  <p className="text-xs text-orange-300 mb-3">Expires in {checkoutCountdown || '...'}</p>
                  <div className="bg-white p-3 rounded-lg inline-block mb-3">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(checkoutData.qrData)}`}
                      alt="Lightning checkout QR code"
                      className="w-48 h-48"
                    />
                  </div>
                  <div className="grid gap-2">
                    <a href={checkoutData.lightningUri} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-3 rounded-lg transition">
                      Open in Wallet
                    </a>
                    <button onClick={copyInvoice} className="bg-white/10 hover:bg-white/20 px-4 py-3 rounded-lg font-semibold">
                      {copiedInvoice ? 'Copied!' : 'Copy Invoice'}
                    </button>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm text-yellow-100 mt-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-300"></div>
                    Waiting for payment...
                  </div>
                </div>
              ) : checkoutStatus === 'paid' ? (
                <div className="mt-5 bg-green-500/20 border border-green-400 text-green-100 rounded-xl p-4 text-center">
                  ✅ Payment received. Your order is confirmed.
                </div>
              ) : checkoutStatus === 'expired' || checkoutStatus === 'failed' ? (
                <div className="mt-5 bg-red-500/20 border border-red-400 text-red-100 rounded-xl p-4 text-center">
                  <p className="mb-3">Checkout {checkoutStatus === 'expired' ? 'expired' : 'failed'}.</p>
                  <button onClick={resetCheckout} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-2 rounded-lg">
                    Try Again
                  </button>
                </div>
              ) : !isAuthenticated ? (
                <Link href="/login" className="block text-center mt-5 bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-5 py-3 rounded-lg transition">
                  Log in to buy
                </Link>
              ) : balanceSats !== null && balanceSats >= finalPrice ? (
                <button
                  onClick={buyShirt}
                  disabled={buying || !selectedVariant || selectedVariant.quantityAvailable <= 0}
                  className="mt-5 w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-bold px-5 py-3 rounded-lg transition"
                >
                  {buying ? 'Placing order...' : `Buy It Now — ${finalPrice.toLocaleString()} sats`}
                </button>
              ) : (
                <button
                  onClick={checkoutWithLightning}
                  disabled={checkingOut || !selectedVariant || selectedVariant.quantityAvailable <= 0}
                  className="mt-5 w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-bold px-5 py-3 rounded-lg transition"
                >
                  {checkingOut ? 'Creating Invoice...' : `Click here to check out with Lightning`}
                </button>
              )}

              <p className="text-xs text-gray-400 mt-4">
                If your site balance covers the price, Buy It Now debits it immediately. Otherwise, Lightning checkout creates an invoice for this item.
              </p>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
