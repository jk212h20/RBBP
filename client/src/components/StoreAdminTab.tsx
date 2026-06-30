'use client';

import { useEffect, useState } from 'react';
import { storeAPI, type StoreProduct } from '@/lib/api';
import ImageUpload from './ImageUpload';

type ProductEdit = {
  name: string;
  description: string;
  imageUrl: string | null;
  priceSats: string;
  isActive: boolean;
};

type VariantEdit = {
  size: string;
  quantityAvailable: string;
  sortOrder: string;
};

type PromoEdit = {
  code: string;
  label: string;
  priceSats: string;
  maxUses: string;
  isActive: boolean;
};

const emptyNewProduct = {
  name: '',
  description: '',
  imageUrl: null as string | null,
  priceSats: '',
  isActive: true,
  firstOption: 'One Size',
  firstQuantity: '0',
};

const emptyNewVariant = { size: '', quantityAvailable: '0', sortOrder: '' };
const emptyNewPromo = { code: '', label: '', priceSats: '', maxUses: '0', isActive: true };

export default function StoreAdminTab() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [productEdits, setProductEdits] = useState<Record<string, ProductEdit>>({});
  const [variantEdits, setVariantEdits] = useState<Record<string, VariantEdit>>({});
  const [promoEdits, setPromoEdits] = useState<Record<string, PromoEdit>>({});
  const [newProduct, setNewProduct] = useState(emptyNewProduct);
  const [newVariants, setNewVariants] = useState<Record<string, VariantEdit>>({});
  const [newPromos, setNewPromos] = useState<Record<string, PromoEdit>>({});
  const [expandedProductIds, setExpandedProductIds] = useState<Record<string, boolean>>({});

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

      const nextProductEdits: Record<string, ProductEdit> = {};
      const nextVariantEdits: Record<string, VariantEdit> = {};
      const nextPromoEdits: Record<string, PromoEdit> = {};
      const nextNewVariants: Record<string, VariantEdit> = {};
      const nextNewPromos: Record<string, PromoEdit> = {};
      const nextExpanded: Record<string, boolean> = {};

      data.products.forEach((product, index) => {
        nextProductEdits[product.id] = {
          name: product.name,
          description: product.description,
          imageUrl: product.imageUrl || null,
          priceSats: String(product.priceSats),
          isActive: product.isActive !== false,
        };
        product.variants.forEach((variant: any) => {
          nextVariantEdits[variant.id] = {
            size: variant.size,
            quantityAvailable: String(variant.quantityAvailable),
            sortOrder: String(variant.sortOrder ?? 0),
          };
        });
        (product.promoCodes || []).forEach((promo: any) => {
          nextPromoEdits[promo.id] = {
            code: promo.code,
            label: promo.label || '',
            priceSats: String(promo.priceSats),
            maxUses: String(promo.maxUses),
            isActive: promo.isActive,
          };
        });
        nextNewVariants[product.id] = { ...emptyNewVariant, sortOrder: String((product.variants?.length || 0) + 1) };
        nextNewPromos[product.id] = { ...emptyNewPromo, priceSats: String(product.priceSats) };
        nextExpanded[product.id] = expandedProductIds[product.id] ?? index === 0;
      });

      setProductEdits(nextProductEdits);
      setVariantEdits(nextVariantEdits);
      setPromoEdits(nextPromoEdits);
      setNewVariants(nextNewVariants);
      setNewPromos(nextNewPromos);
      setExpandedProductIds(nextExpanded);
    } catch (err: any) {
      setError(err.message || 'Failed to load store admin');
    } finally {
      setLoading(false);
    }
  };

  const withSave = async (action: () => Promise<void>, successMessage: string) => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await action();
      setMessage(successMessage);
      await loadStore();
    } catch (err: any) {
      setError(err.message || 'Store update failed');
    } finally {
      setSaving(false);
    }
  };

  const createProduct = async () => {
    await withSave(async () => {
      await storeAPI.createProduct({
        name: newProduct.name,
        description: newProduct.description,
        imageUrl: newProduct.imageUrl,
        priceSats: parseInt(newProduct.priceSats, 10),
        isActive: newProduct.isActive,
        variants: [{
          size: newProduct.firstOption || 'One Size',
          quantityAvailable: parseInt(newProduct.firstQuantity || '0', 10),
          sortOrder: 1,
        }],
      });
      setNewProduct(emptyNewProduct);
    }, 'Store item created');
  };

  const saveProduct = async (product: StoreProduct) => {
    const edit = productEdits[product.id];
    if (!edit) return;
    await withSave(async () => {
      await storeAPI.updateProduct(product.id, {
        name: edit.name,
        description: edit.description,
        imageUrl: edit.imageUrl,
        priceSats: parseInt(edit.priceSats, 10),
        isActive: edit.isActive,
      });
    }, 'Store item updated');
  };

  const saveVariant = async (variantId: string) => {
    const edit = variantEdits[variantId];
    if (!edit) return;
    await withSave(async () => {
      await storeAPI.updateVariant(variantId, {
        size: edit.size,
        quantityAvailable: parseInt(edit.quantityAvailable, 10),
        sortOrder: parseInt(edit.sortOrder || '0', 10),
      });
    }, 'Option/inventory updated');
  };

  const createVariant = async (productId: string) => {
    const edit = newVariants[productId];
    if (!edit) return;
    await withSave(async () => {
      await storeAPI.createVariant(productId, {
        size: edit.size,
        quantityAvailable: parseInt(edit.quantityAvailable || '0', 10),
        sortOrder: edit.sortOrder ? parseInt(edit.sortOrder, 10) : undefined,
      });
    }, 'Option added');
  };

  const savePromo = async (promoId: string) => {
    const edit = promoEdits[promoId];
    if (!edit) return;
    await withSave(async () => {
      await storeAPI.updatePromoCode(promoId, {
        code: edit.code,
        label: edit.label || null,
        priceSats: parseInt(edit.priceSats, 10),
        maxUses: parseInt(edit.maxUses, 10),
        isActive: edit.isActive,
      });
    }, 'Promo code updated');
  };

  const createPromo = async (productId: string) => {
    const edit = newPromos[productId];
    if (!edit) return;
    await withSave(async () => {
      await storeAPI.createPromoCode(productId, {
        code: edit.code,
        label: edit.label || null,
        priceSats: parseInt(edit.priceSats, 10),
        maxUses: parseInt(edit.maxUses || '0', 10),
        isActive: edit.isActive,
      });
    }, 'Promo code added');
  };

  if (loading) {
    return <div className="text-gray-400 py-8">Loading store admin...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">🛒 Store</h2>
        <p className="text-gray-400">Create store items, organize options/sizes, manage inventory, promos, and recent orders.</p>
      </div>

      {message && <div className="bg-green-900/50 border border-green-600 text-green-200 p-3 rounded-lg">{message}</div>}
      {error && <div className="bg-red-900/50 border border-red-600 text-red-200 p-3 rounded-lg">{error}</div>}

      <div className="bg-gray-800 rounded-lg p-6 border border-green-700/50 space-y-5">
        <div>
          <h3 className="text-xl font-bold text-green-300">➕ Add Store Item</h3>
          <p className="text-gray-400 text-sm">Create a new item with at least one option/size. You can add more options after saving.</p>
        </div>
        <div className="grid md:grid-cols-[260px_1fr] gap-5 items-start">
          <ImageUpload
            currentImage={newProduct.imageUrl}
            onImageChange={(imageData) => setNewProduct(prev => ({ ...prev, imageUrl: imageData }))}
            label="New item image"
            maxSizeKB={500}
          />
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Item name</label>
                <input value={newProduct.name} onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))} placeholder="League Hat" className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Price sats</label>
                <input type="number" min="1" value={newProduct.priceSats} onChange={(e) => setNewProduct(prev => ({ ...prev, priceSats: e.target.value }))} placeholder="25000" className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Description</label>
              <textarea value={newProduct.description} onChange={(e) => setNewProduct(prev => ({ ...prev, description: e.target.value }))} rows={3} placeholder="Short description shown in the player store" className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white" />
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">First option/size</label>
                <input value={newProduct.firstOption} onChange={(e) => setNewProduct(prev => ({ ...prev, firstOption: e.target.value }))} placeholder="One Size" className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Initial quantity</label>
                <input type="number" min="0" value={newProduct.firstQuantity} onChange={(e) => setNewProduct(prev => ({ ...prev, firstQuantity: e.target.value }))} className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-200 pt-7">
                <input type="checkbox" checked={newProduct.isActive} onChange={(e) => setNewProduct(prev => ({ ...prev, isActive: e.target.checked }))} />
                Active in store
              </label>
            </div>
            <button onClick={createProduct} disabled={saving} className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-3 rounded-lg font-semibold">
              Create Store Item
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-bold">Store Items ({products.length})</h3>
        {products.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-gray-400">No store items yet.</div>
        ) : products.map(product => {
          const productEdit = productEdits[product.id];
          const isExpanded = expandedProductIds[product.id] !== false;
          return (
            <div key={product.id} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedProductIds(prev => ({ ...prev, [product.id]: !isExpanded }))}
                className="w-full p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-left hover:bg-gray-700/40 transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold">{product.name}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${product.isActive ? 'bg-green-900 text-green-200' : 'bg-gray-700 text-gray-300'}`}>
                      {product.isActive ? 'Active' : 'Hidden'}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm">
                    {product.priceSats.toLocaleString()} sats • {product.variants.length} option{product.variants.length === 1 ? '' : 's'} • Orders: {product._count?.orders || 0}
                  </p>
                </div>
                <span className="text-gray-400">{isExpanded ? '▲ Collapse' : '▼ Manage'}</span>
              </button>

              {isExpanded && productEdit && (
                <div className="p-6 border-t border-gray-700 space-y-6">
                  <div className="grid md:grid-cols-[280px_1fr] gap-5 items-start">
                    <ImageUpload
                      currentImage={productEdit.imageUrl}
                      onImageChange={(imageData) => setProductEdits(prev => ({ ...prev, [product.id]: { ...prev[product.id], imageUrl: imageData } }))}
                      label="Item image"
                      maxSizeKB={500}
                    />

                    <div className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-300 mb-1">Item name</label>
                          <input value={productEdit.name} onChange={(e) => setProductEdits(prev => ({ ...prev, [product.id]: { ...prev[product.id], name: e.target.value } }))} className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white" />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-300 mb-1">Price sats</label>
                          <input type="number" min="1" value={productEdit.priceSats} onChange={(e) => setProductEdits(prev => ({ ...prev, [product.id]: { ...prev[product.id], priceSats: e.target.value } }))} className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-300 mb-1">Description</label>
                        <textarea value={productEdit.description} onChange={(e) => setProductEdits(prev => ({ ...prev, [product.id]: { ...prev[product.id], description: e.target.value } }))} rows={4} className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white" />
                      </div>

                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={productEdit.isActive} onChange={(e) => setProductEdits(prev => ({ ...prev, [product.id]: { ...prev[product.id], isActive: e.target.checked } }))} />
                        Active in player store
                      </label>

                      <button onClick={() => saveProduct(product)} disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg">
                        Save Item
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-gray-700 pt-5">
                    <h4 className="font-bold mb-3">Options / Sizes / Inventory</h4>
                    <div className="space-y-3">
                      {product.variants.map((variant: any) => {
                        const edit = variantEdits[variant.id];
                        return (
                          <div key={variant.id} className="grid md:grid-cols-[1.2fr_1fr_1fr_auto] gap-3 items-end bg-gray-900/70 p-3 rounded-lg">
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Option/size</label>
                              <input value={edit?.size || ''} onChange={(e) => setVariantEdits(prev => ({ ...prev, [variant.id]: { ...prev[variant.id], size: e.target.value } }))} className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white" />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Available</label>
                              <input type="number" min="0" value={edit?.quantityAvailable || ''} onChange={(e) => setVariantEdits(prev => ({ ...prev, [variant.id]: { ...prev[variant.id], quantityAvailable: e.target.value } }))} className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white" />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Sort</label>
                              <input type="number" value={edit?.sortOrder || ''} onChange={(e) => setVariantEdits(prev => ({ ...prev, [variant.id]: { ...prev[variant.id], sortOrder: e.target.value } }))} className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white" />
                            </div>
                            <button onClick={() => saveVariant(variant.id)} disabled={saving} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-3 py-2 rounded">
                              Save
                            </button>
                          </div>
                        );
                      })}

                      <div className="grid md:grid-cols-[1.2fr_1fr_1fr_auto] gap-3 items-end bg-purple-900/20 border border-purple-700/40 p-3 rounded-lg">
                        <div>
                          <label className="block text-xs text-purple-200 mb-1">New option/size</label>
                          <input value={newVariants[product.id]?.size || ''} onChange={(e) => setNewVariants(prev => ({ ...prev, [product.id]: { ...(prev[product.id] || emptyNewVariant), size: e.target.value } }))} placeholder="XL / Red / One Size" className="w-full bg-gray-900 border border-purple-600 rounded p-2 text-white" />
                        </div>
                        <div>
                          <label className="block text-xs text-purple-200 mb-1">Quantity</label>
                          <input type="number" min="0" value={newVariants[product.id]?.quantityAvailable || '0'} onChange={(e) => setNewVariants(prev => ({ ...prev, [product.id]: { ...(prev[product.id] || emptyNewVariant), quantityAvailable: e.target.value } }))} className="w-full bg-gray-900 border border-purple-600 rounded p-2 text-white" />
                        </div>
                        <div>
                          <label className="block text-xs text-purple-200 mb-1">Sort</label>
                          <input type="number" value={newVariants[product.id]?.sortOrder || ''} onChange={(e) => setNewVariants(prev => ({ ...prev, [product.id]: { ...(prev[product.id] || emptyNewVariant), sortOrder: e.target.value } }))} className="w-full bg-gray-900 border border-purple-600 rounded p-2 text-white" />
                        </div>
                        <button onClick={() => createVariant(product.id)} disabled={saving} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-3 py-2 rounded">
                          Add Option
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-700 pt-5">
                    <h4 className="font-bold mb-3">Promo Codes</h4>
                    <div className="space-y-3">
                      {(product.promoCodes || []).map((promo: any) => {
                        const edit = promoEdits[promo.id];
                        return (
                          <div key={promo.id} className="grid md:grid-cols-[1fr_1fr_1fr_1fr_auto_auto] gap-3 items-end bg-gray-900/70 p-3 rounded-lg">
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Code</label>
                              <input value={edit?.code || ''} onChange={(e) => setPromoEdits(prev => ({ ...prev, [promo.id]: { ...prev[promo.id], code: e.target.value.toUpperCase() } }))} className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white font-mono" />
                              <div className="text-gray-500 text-xs mt-1">Used {promo.uses} / {promo.maxUses}</div>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Label</label>
                              <input value={edit?.label || ''} onChange={(e) => setPromoEdits(prev => ({ ...prev, [promo.id]: { ...prev[promo.id], label: e.target.value } }))} className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white" />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Promo price</label>
                              <input type="number" min="1" value={edit?.priceSats || ''} onChange={(e) => setPromoEdits(prev => ({ ...prev, [promo.id]: { ...prev[promo.id], priceSats: e.target.value } }))} className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white" />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Max uses</label>
                              <input type="number" min="0" value={edit?.maxUses || ''} onChange={(e) => setPromoEdits(prev => ({ ...prev, [promo.id]: { ...prev[promo.id], maxUses: e.target.value } }))} className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white" />
                            </div>
                            <label className="flex items-center gap-2 text-sm pb-2">
                              <input type="checkbox" checked={edit?.isActive || false} onChange={(e) => setPromoEdits(prev => ({ ...prev, [promo.id]: { ...prev[promo.id], isActive: e.target.checked } }))} />
                              Active
                            </label>
                            <button onClick={() => savePromo(promo.id)} disabled={saving} className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-black font-semibold px-3 py-2 rounded">
                              Save
                            </button>
                          </div>
                        );
                      })}

                      <div className="grid md:grid-cols-[1fr_1fr_1fr_1fr_auto_auto] gap-3 items-end bg-yellow-900/20 border border-yellow-700/40 p-3 rounded-lg">
                        <div>
                          <label className="block text-xs text-yellow-200 mb-1">New code</label>
                          <input value={newPromos[product.id]?.code || ''} onChange={(e) => setNewPromos(prev => ({ ...prev, [product.id]: { ...(prev[product.id] || emptyNewPromo), code: e.target.value.toUpperCase() } }))} placeholder="LAUNCH" className="w-full bg-gray-900 border border-yellow-600 rounded p-2 text-white font-mono" />
                        </div>
                        <div>
                          <label className="block text-xs text-yellow-200 mb-1">Label</label>
                          <input value={newPromos[product.id]?.label || ''} onChange={(e) => setNewPromos(prev => ({ ...prev, [product.id]: { ...(prev[product.id] || emptyNewPromo), label: e.target.value } }))} placeholder="Launch special" className="w-full bg-gray-900 border border-yellow-600 rounded p-2 text-white" />
                        </div>
                        <div>
                          <label className="block text-xs text-yellow-200 mb-1">Promo price</label>
                          <input type="number" min="1" value={newPromos[product.id]?.priceSats || ''} onChange={(e) => setNewPromos(prev => ({ ...prev, [product.id]: { ...(prev[product.id] || emptyNewPromo), priceSats: e.target.value } }))} className="w-full bg-gray-900 border border-yellow-600 rounded p-2 text-white" />
                        </div>
                        <div>
                          <label className="block text-xs text-yellow-200 mb-1">Max uses</label>
                          <input type="number" min="0" value={newPromos[product.id]?.maxUses || '0'} onChange={(e) => setNewPromos(prev => ({ ...prev, [product.id]: { ...(prev[product.id] || emptyNewPromo), maxUses: e.target.value } }))} className="w-full bg-gray-900 border border-yellow-600 rounded p-2 text-white" />
                        </div>
                        <label className="flex items-center gap-2 text-sm pb-2">
                          <input type="checkbox" checked={newPromos[product.id]?.isActive ?? true} onChange={(e) => setNewPromos(prev => ({ ...prev, [product.id]: { ...(prev[product.id] || emptyNewPromo), isActive: e.target.checked } }))} />
                          Active
                        </label>
                        <button onClick={() => createPromo(product.id)} disabled={saving} className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-black font-semibold px-3 py-2 rounded">
                          Add Promo
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-bold mb-4">Recent Store Orders</h3>
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
                  <th>Option</th>
                  <th>Status</th>
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
                    <td>{order.status}</td>
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
