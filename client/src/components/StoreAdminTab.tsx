'use client';

import { useEffect, useState } from 'react';
import { storeAPI, type StoreProduct } from '@/lib/api';

export default function StoreAdminTab() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [productEdits, setProductEdits] = useState<Record<string, { description: string; priceSats: string; isActive: boolean }>>({});
  const [variantEdits, setVariantEdits] = useState<Record<string, string>>({});
  const [promoEdits, setPromoEdits] = useState<Record<string, { priceSats: string; maxUses: string; isActive: boolean }>>({});

  useEffect(() => {
    loadStore();
  }, []);

  const loadStore = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await storeAPI.getAdminStore();
      setProducts(data.products);
      setOrders(data.recentOrders);

      const nextProductEdits: typeof productEdits = {};
      const nextVariantEdits: typeof variantEdits = {};
      const nextPromoEdits: typeof promoEdits = {};

      data.products.forEach(product => {
        nextProductEdits[product.id] = {
          description: product.description,
          priceSats: String(product.priceSats),
          isActive: product.isActive !== false,
        };
        product.variants.forEach(variant => {
          nextVariantEdits[variant.id] = String(variant.quantityAvailable);
        });
        (product.promoCodes || []).forEach((promo: any) => {
          nextPromoEdits[promo.id] = {
            priceSats: String(promo.priceSats),
            maxUses: String(promo.maxUses),
            isActive: promo.isActive,
          };
        });
      });

      setProductEdits(nextProductEdits);
      setVariantEdits(nextVariantEdits);
      setPromoEdits(nextPromoEdits);
    } catch (err: any) {
      setError(err.message || 'Failed to load store admin');
    } finally {
      setLoading(false);
    }
  };

  const saveProduct = async (product: StoreProduct) => {
    const edit = productEdits[product.id];
    if (!edit) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await storeAPI.updateProduct(product.id, {
        description: edit.description,
        priceSats: parseInt(edit.priceSats, 10),
        isActive: edit.isActive,
      });
      setMessage('Store item updated');
      await loadStore();
    } catch (err: any) {
      setError(err.message || 'Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  const saveVariant = async (variantId: string) => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await storeAPI.updateVariant(variantId, {
        quantityAvailable: parseInt(variantEdits[variantId], 10),
      });
      setMessage('Inventory updated');
      await loadStore();
    } catch (err: any) {
      setError(err.message || 'Failed to update inventory');
    } finally {
      setSaving(false);
    }
  };

  const savePromo = async (promoId: string) => {
    const edit = promoEdits[promoId];
    if (!edit) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await storeAPI.updatePromoCode(promoId, {
        priceSats: parseInt(edit.priceSats, 10),
        maxUses: parseInt(edit.maxUses, 10),
        isActive: edit.isActive,
      });
      setMessage('Promo code updated');
      await loadStore();
    } catch (err: any) {
      setError(err.message || 'Failed to update promo');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-gray-400 py-8">Loading store admin...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">🛒 Store</h2>
        <p className="text-gray-400">Manage the shirt description, price, inventory, and launch promo code.</p>
      </div>

      {message && <div className="bg-green-900/50 border border-green-600 text-green-200 p-3 rounded-lg">{message}</div>}
      {error && <div className="bg-red-900/50 border border-red-600 text-red-200 p-3 rounded-lg">{error}</div>}

      {products.map(product => {
        const productEdit = productEdits[product.id];
        return (
          <div key={product.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold">{product.name}</h3>
                <p className="text-gray-400 text-sm">Orders: {product._count?.orders || 0}</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={productEdit?.isActive || false}
                  onChange={(e) => setProductEdits(prev => ({
                    ...prev,
                    [product.id]: { ...prev[product.id], isActive: e.target.checked },
                  }))}
                />
                Active in store
              </label>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Description text</label>
              <textarea
                value={productEdit?.description || ''}
                onChange={(e) => setProductEdits(prev => ({
                  ...prev,
                  [product.id]: { ...prev[product.id], description: e.target.value },
                }))}
                rows={4}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid md:grid-cols-[220px_auto] gap-4 items-end">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Regular price, sats</label>
                <input
                  type="number"
                  min="1"
                  value={productEdit?.priceSats || ''}
                  onChange={(e) => setProductEdits(prev => ({
                    ...prev,
                    [product.id]: { ...prev[product.id], priceSats: e.target.value },
                  }))}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={() => saveProduct(product)}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-3 rounded-lg font-semibold"
              >
                Save Item
              </button>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Inventory by size</h4>
              <div className="grid md:grid-cols-5 gap-3">
                {product.variants.map(variant => (
                  <div key={variant.id} className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                    <label className="block text-sm text-gray-300 mb-1">{variant.size}</label>
                    <input
                      type="number"
                      min="0"
                      value={variantEdits[variant.id] || '0'}
                      onChange={(e) => setVariantEdits(prev => ({ ...prev, [variant.id]: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                    />
                    <button
                      onClick={() => saveVariant(variant.id)}
                      disabled={saving}
                      className="mt-2 w-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 px-2 py-1 rounded text-sm"
                    >
                      Save
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Promo codes</h4>
              {(product.promoCodes || []).map((promo: any) => {
                const edit = promoEdits[promo.id];
                return (
                  <div key={promo.id} className="bg-gray-900 rounded-lg p-4 border border-gray-700 grid md:grid-cols-[1fr_160px_140px_120px_120px] gap-3 items-end">
                    <div>
                      <div className="text-yellow-300 font-mono font-bold">{promo.code}</div>
                      <div className="text-gray-400 text-sm">Used {promo.uses} / {promo.maxUses}</div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Promo price</label>
                      <input
                        type="number"
                        min="1"
                        value={edit?.priceSats || ''}
                        onChange={(e) => setPromoEdits(prev => ({
                          ...prev,
                          [promo.id]: { ...prev[promo.id], priceSats: e.target.value },
                        }))}
                        className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Max uses</label>
                      <input
                        type="number"
                        min="0"
                        value={edit?.maxUses || ''}
                        onChange={(e) => setPromoEdits(prev => ({
                          ...prev,
                          [promo.id]: { ...prev[promo.id], maxUses: e.target.value },
                        }))}
                        className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm pb-2">
                      <input
                        type="checkbox"
                        checked={edit?.isActive || false}
                        onChange={(e) => setPromoEdits(prev => ({
                          ...prev,
                          [promo.id]: { ...prev[promo.id], isActive: e.target.checked },
                        }))}
                      />
                      Active
                    </label>
                    <button
                      onClick={() => savePromo(promo.id)}
                      disabled={saving}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-3 py-2 rounded font-semibold"
                    >
                      Save Promo
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-bold mb-4">Recent store orders</h3>
        {orders.length === 0 ? (
          <p className="text-gray-400">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="py-2">Date</th>
                  <th>Player</th>
                  <th>Item</th>
                  <th>Size</th>
                  <th>Price</th>
                  <th>Promo</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id} className="border-b border-gray-700/50">
                    <td className="py-2">{new Date(order.createdAt).toLocaleString()}</td>
                    <td>{order.user?.name}</td>
                    <td>{order.product?.name}</td>
                    <td>{order.variant?.size}</td>
                    <td>{order.pricePaidSats.toLocaleString()} sats</td>
                    <td>{order.promoCode?.code || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
