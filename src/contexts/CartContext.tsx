import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { CartItem, Product, Promotion } from '../types';
import { useSettings } from './SettingsContext';
import { useAuth } from './AuthContext';
import { supabase } from '../supabase';

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, size: string, color?: string, quantity?: number) => void;
  removeFromCart: (productId: string, size: string, color?: string) => void;
  updateQuantity: (productId: string, size: string, quantity: number, color?: string) => void;
  clearCart: () => void;
  total: number;
  subtotal: number;
  totalDiscount: number;
  autoOfferDiscount: number;
  promoDiscount: number;
  itemCount: number;
  appliedPromo: { code: string; discount: number } | null;
  setAppliedPromo: (promo: { code: string; discount: number } | null) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Tombstone tracking to guarantee deleted items never resurrect on page reload or sync
const getRemovedTombstones = (): Array<{ productId: string; size: string; color: string; timestamp: number }> => {
  try {
    const raw = localStorage.getItem('ruby_cart_removed_items');
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const now = Date.now();
    return list.filter((r: any) => now - (Number(r.timestamp) || 0) < 7 * 86400000); // 7 days retention
  } catch (e) {
    return [];
  }
};

const addRemovedTombstone = (productId: string, size?: string, color?: string) => {
  try {
    const list = getRemovedTombstones();
    const cleanSize = (size || '').trim().toLowerCase();
    const cleanColor = (color || '').trim().toLowerCase();
    const updated = [
      ...list.filter(r => !(r.productId === productId && r.size === cleanSize && r.color === cleanColor)),
      { productId, size: cleanSize, color: cleanColor, timestamp: Date.now() }
    ];
    localStorage.setItem('ruby_cart_removed_items', JSON.stringify(updated));
  } catch (e) {}
};

const clearRemovedTombstone = (productId: string, size?: string, color?: string) => {
  try {
    const list = getRemovedTombstones();
    const cleanSize = (size || '').trim().toLowerCase();
    const cleanColor = (color || '').trim().toLowerCase();
    const updated = list.filter(r => !(r.productId === productId && (!cleanSize || r.size === cleanSize) && (!cleanColor || r.color === cleanColor)));
    localStorage.setItem('ruby_cart_removed_items', JSON.stringify(updated));
  } catch (e) {}
};

const isItemTombstoned = (productId: string, size?: string, color?: string, tombstones?: Array<{ productId: string; size: string; color: string }>): boolean => {
  const list = tombstones || getRemovedTombstones();
  const cleanSize = (size || '').trim().toLowerCase();
  const cleanColor = (color || '').trim().toLowerCase();
  return list.some(r => 
    r.productId === productId && 
    (!r.size || r.size === cleanSize) && 
    (!r.color || r.color === cleanColor)
  );
};

export const deduplicateCartItems = (list: CartItem[]): CartItem[] => {
  const merged: CartItem[] = [];
  for (const item of list) {
    if (!item || !item.id) continue;
    const sSize = (item.selectedSize || '').trim();
    const sColor = (item.selectedColor || '').trim();
    const existingIndex = merged.findIndex(m => 
      m && m.id === item.id && 
      (m.selectedSize || '').trim() === sSize && 
      (m.selectedColor || '').trim().toLowerCase() === sColor.toLowerCase()
    );
    if (existingIndex !== -1) {
      const existingQty = Number(merged[existingIndex].quantity) || 1;
      const addedQty = Number(item.quantity) || 1;
      const stockLimit = merged[existingIndex].stock !== undefined && merged[existingIndex].stock !== null 
        ? Number(merged[existingIndex].stock) 
        : 99;
      merged[existingIndex].quantity = Math.min(stockLimit, existingQty + addedQty);
      if (item.cartItemId && !merged[existingIndex].cartItemId) {
        merged[existingIndex].cartItemId = item.cartItemId;
      }
    } else {
      merged.push({ ...item, selectedSize: sSize, selectedColor: sColor });
    }
  }
  return merged;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const tombstones = getRemovedTombstones();
      const saved = localStorage.getItem('ruby_cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(Boolean).filter(i => !isItemTombstoned(i.id, i.selectedSize, i.selectedColor, tombstones));
          return deduplicateCartItems(filtered);
        }
      }
      return [];
    } catch (e) {
      console.warn("Failed to parse ruby_cart:", e);
      return [];
    }
  });
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  const lastFetchedUserId = useRef<string | null>(null);

  // Load and Merge cart from Supabase on user/auth state resolution
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      lastFetchedUserId.current = null;
      setCartLoaded(true);
      return;
    }

    if (lastFetchedUserId.current === user.uid) {
      setCartLoaded(true);
      return;
    }

    const fetchAndMergeCart = async () => {
      try {
        const userId = user?.id || user?.uid;
        if (!userId) {
          setCartLoaded(true);
          return;
        }

        // 1. Fetch existing cart items from Supabase
        const { data: dbItemsData, error: dbItemsErr } = await supabase
          .from('cart_items')
          .select('*, products(*)')
          .eq('user_id', userId);

        if (dbItemsErr) {
          console.error("Error fetching cart items from Supabase:", dbItemsErr);
          setCartLoaded(true);
          return;
        }

        const tombstones = getRemovedTombstones();

        // Parse db items and filter against tombstones
        const cleanedRawDbItems: CartItem[] = [];
        for (const row of (dbItemsData || [])) {
          const p = Array.isArray(row.products) ? row.products[0] : row.products;
          if (!p) continue;

          const sSize = (row.size || '').trim();
          const sColor = (row.color || '').trim();

          // If this item was deleted by the user, delete it from Supabase in background and do not restore it
          if (isItemTombstoned(p.id, sSize, sColor, tombstones)) {
            supabase.from('cart_items').delete().eq('id', row.id).then(() => {});
            continue;
          }

          cleanedRawDbItems.push({
            ...p,
            id: p.id,
            cartItemId: row.id,
            name: p.name || '',
            description: p.description || '',
            price: Number(p.price || 0),
            comparePrice: p.compare_price ? Number(p.compare_price) : undefined,
            sizes: Array.isArray(p.sizes) ? p.sizes : [],
            images: Array.isArray(p.images) ? p.images : [],
            stock: Number(p.stock ?? 0),
            stockStatus: p.stock_status || undefined,
            createdAt: p.created_at || new Date().toISOString(),
            isTrending: p.is_trending ?? false,
            isPopular: p.is_popular ?? false,
            sku: p.sku || undefined,
            barcode: p.barcode || undefined,
            weight: p.weight || undefined,
            dimensions: p.dimensions || undefined,
            seoTitle: p.seo_title || undefined,
            seoDescription: p.seo_description || undefined,
            variants: p.variants || [],
            viewCount: p.view_count ?? 0,
            category: p.category_ids || [],
            
            selectedSize: sSize,
            selectedColor: sColor,
            quantity: Number(row.quantity) || 1
          } as CartItem);
        }

        const dbItems = deduplicateCartItems(cleanedRawDbItems);

        // Check if guest cart needs to be merged (ONLY once per user login ever)
        const syncKey = `ruby_cart_synced_${userId}`;
        const alreadySynced = localStorage.getItem(syncKey) === 'true';

        if (!alreadySynced) {
          // 2. Read local guest items for initial login merge
          const localSaved = localStorage.getItem('ruby_cart');
          let localItems: CartItem[] = [];
          if (localSaved) {
            try {
              const parsed = JSON.parse(localSaved);
              if (Array.isArray(parsed)) {
                localItems = parsed.filter(Boolean).filter(i => !isItemTombstoned(i.id, i.selectedSize, i.selectedColor, tombstones));
              }
            } catch (e) {
              console.warn("Failed to parse local cart:", e);
            }
          }

          if (localItems.length > 0) {
            const mergedList = [...dbItems];

            for (const localItem of localItems) {
              const safeLocalSize = (localItem.selectedSize || '').trim();
              const safeLocalColor = (localItem.selectedColor || '').trim();

              const existingIndex = mergedList.findIndex(i =>
                i.id === localItem.id &&
                (i.selectedSize || '').trim() === safeLocalSize &&
                (i.selectedColor || '').trim().toLowerCase() === safeLocalColor.toLowerCase()
              );

              if (existingIndex !== -1) {
                const newQty = Math.max(mergedList[existingIndex].quantity, localItem.quantity);
                mergedList[existingIndex].quantity = newQty;

                const dbRow = dbItemsData?.find(r => 
                  r.product_id === localItem.id &&
                  (r.size || '').trim() === safeLocalSize &&
                  (r.color || '').trim().toLowerCase() === safeLocalColor.toLowerCase()
                );
                if (dbRow) {
                  await supabase
                    .from('cart_items')
                    .update({ quantity: newQty, updated_at: new Date().toISOString() })
                    .eq('id', dbRow.id);
                }
              } else {
                const { data: insertedRow } = await supabase
                  .from('cart_items')
                  .insert({
                    user_id: userId,
                    product_id: localItem.id,
                    size: safeLocalSize,
                    color: safeLocalColor,
                    quantity: localItem.quantity,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  })
                  .select('id')
                  .single();

                mergedList.push({
                  ...localItem,
                  cartItemId: insertedRow?.id || localItem.cartItemId
                });
              }
            }

            const dedupedMerged = deduplicateCartItems(mergedList);
            setItems(dedupedMerged);
            try {
              localStorage.setItem('ruby_cart', JSON.stringify(dedupedMerged));
            } catch (e) {}
          } else {
            setItems(dbItems);
            try {
              localStorage.setItem('ruby_cart', JSON.stringify(dbItems));
            } catch (e) {}
          }
          localStorage.setItem(syncKey, 'true');
        } else {
          // Already logged in session: Supabase is authoritative, never resurrect deleted items
          setItems(dbItems);
          try {
            localStorage.setItem('ruby_cart', JSON.stringify(dbItems));
          } catch (e) {}
        }

        lastFetchedUserId.current = userId;
      } catch (err) {
        console.error("Error loading/merging cart from Supabase:", err);
      } finally {
        setCartLoaded(true);
      }
    };

    setCartLoaded(false);
    fetchAndMergeCart();
  }, [user, authLoading]);

  // Save cart state locally as continuous resilient backup cache across navigation
  useEffect(() => {
    try {
      if (Array.isArray(items)) {
        localStorage.setItem('ruby_cart', JSON.stringify(items.filter(Boolean)));
      }
    } catch (err) {
      // Silent
    }
  }, [items]);

  useEffect(() => {
    const fetchActivePromotions = async () => {
      try {
        const { data, error } = await supabase
          .from('promotions')
          .select('*')
          .eq('status', 'active')
          .order('priority', { ascending: true });

        if (error) throw error;

        if (data) {
          const formatted = data.map((p: any) => ({
            ...p,
            bxgyConfig: p.bxgy_config || p.bxgyConfig || { buyQty: 2, getQty: 1, applyOn: 'same', maxFree: 1, repeat: false },
            conditions: p.conditions || { minCartValue: 0, minQuantity: 0, productIds: [], categoryIds: [], userType: 'all', startDate: '', endDate: '' },
            reward: p.reward || { method: 'auto', value: 100 },
            limits: p.limits || { perUser: 1, totalUsage: 100, maxDiscount: 0 },
            stackable: p.stackable ?? false
          }));
          setPromotions(formatted as Promotion[]);
        }
      } catch (error: any) {
        console.error("Error fetching promotions from Supabase:", error);
      }
    };
    fetchActivePromotions();
  }, []);

  const addToCart = async (product: Product, size: string, color?: string, quantity: number = 1) => {
    if (!product || !product.id) return;
    const safeQuantity = isNaN(Number(quantity)) || Number(quantity) < 1 ? 1 : Number(quantity);
    const productStockValue = product.stock !== undefined && product.stock !== null ? Number(product.stock) : 99;
    const stockLimit = isNaN(productStockValue) ? 99 : productStockValue;
    const safeSize = (size || '').trim();
    const safeColor = (color || '').trim();
    
    // Clear any tombstone so re-adding intentionally works
    clearRemovedTombstone(product.id, safeSize, safeColor);

    setItems(prev => {
      const safePrev = deduplicateCartItems(Array.isArray(prev) ? prev.filter(Boolean) : []);
      const existingIndex = safePrev.findIndex(i => 
        i && i.id === product.id && 
        (i.selectedSize || '').trim() === safeSize && 
        (i.selectedColor || '').trim().toLowerCase() === safeColor.toLowerCase()
      );
      if (existingIndex !== -1) {
        const existingQty = isNaN(Number(safePrev[existingIndex].quantity)) ? 1 : Number(safePrev[existingIndex].quantity);
        const newQuantity = Math.min(stockLimit, existingQty + safeQuantity);
        
        return safePrev.map((i, idx) => 
          idx === existingIndex 
            ? { ...i, quantity: newQuantity } 
            : i
        );
      }
      const initialQuantity = Math.min(stockLimit, safeQuantity);
      return [...safePrev, { ...product, selectedSize: safeSize, selectedColor: safeColor, quantity: initialQuantity }];
    });

    const userId = user?.id || user?.uid || (user as any)?.sub;
    if (userId) {
      try {
        const { data: existingRows } = await supabase
          .from('cart_items')
          .select('id, quantity, color')
          .eq('user_id', userId)
          .eq('product_id', product.id)
          .eq('size', safeSize);

        const matchingRow = (existingRows || []).find((r: any) => (r.color || '').trim().toLowerCase() === safeColor.toLowerCase());

        if (matchingRow) {
          const newQty = Math.min(stockLimit, (matchingRow.quantity || 1) + safeQuantity);
          await supabase
            .from('cart_items')
            .update({ quantity: newQty, updated_at: new Date().toISOString() })
            .eq('id', matchingRow.id);

          // Clean up any extra duplicates if any exist in DB
          const dupes = (existingRows || []).filter((r: any) => r.id !== matchingRow.id && (r.color || '').trim().toLowerCase() === safeColor.toLowerCase());
          for (const d of dupes) {
            await supabase.from('cart_items').delete().eq('id', d.id);
          }
        } else {
          const initialQuantity = Math.min(stockLimit, safeQuantity);
          const { data: newRow } = await supabase
            .from('cart_items')
            .insert({
              user_id: userId,
              product_id: product.id,
              size: safeSize,
              color: safeColor,
              quantity: initialQuantity,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select('id')
            .single();

          if (newRow?.id) {
            setItems(prev => prev.map(i => 
              (i && i.id === product.id && (i.selectedSize || '').trim() === safeSize && (i.selectedColor || '').trim().toLowerCase() === safeColor.toLowerCase())
                ? { ...i, cartItemId: newRow.id }
                : i
            ));
          }
        }
      } catch (err) {
        console.error("Error adding to Supabase cart:", err);
      }
    }
  };

  const removeFromCart = async (productId: string, size: string, color?: string) => {
    if (!productId) return;
    const targetSize = (size || '').trim().toLowerCase();
    const targetColor = (color || '').trim().toLowerCase();

    // 1. Add permanent tombstone to guarantee deleted product NEVER resurrects on reload or sync
    addRemovedTombstone(productId, targetSize, targetColor);

    const idsToDeleteFromDb: string[] = [];

    // 2. Synchronously filter state and local storage immediately
    setItems(prev => {
      const currentList = Array.isArray(prev) ? prev.filter(Boolean) : [];
      const updated = currentList.filter(i => {
        if (!i || !i.id) return false;
        if (i.id !== productId) return true;

        const iSize = (i.selectedSize || '').trim().toLowerCase();
        const iColor = (i.selectedColor || '').trim().toLowerCase();

        const sizeMatches = !targetSize || iSize === targetSize;
        const colorMatches = !targetColor || iColor === targetColor;

        if (sizeMatches && colorMatches) {
          if (i.cartItemId) {
            idsToDeleteFromDb.push(i.cartItemId);
          }
          return false; // Remove this item!
        }
        return true;
      });

      try {
        localStorage.setItem('ruby_cart', JSON.stringify(updated));
      } catch (e) {}

      return updated;
    });

    // 3. Delete from Supabase robustly using multiple targeted operations
    const userId = user?.id || user?.uid || (user as any)?.sub;
    if (userId) {
      try {
        // Delete by tracked cartItemId
        for (const cid of idsToDeleteFromDb) {
          await supabase.from('cart_items').delete().eq('id', cid);
        }

        // Query database to find and delete any matching rows by user_id + product_id
        const { data: dbRows } = await supabase
          .from('cart_items')
          .select('id, size, color')
          .eq('user_id', userId)
          .eq('product_id', productId);

        if (dbRows && dbRows.length > 0) {
          for (const row of dbRows) {
            const rSize = (row.size || '').trim().toLowerCase();
            const rColor = (row.color || '').trim().toLowerCase();
            const sizeMatches = !targetSize || rSize === targetSize;
            const colorMatches = !targetColor || rColor === targetColor;

            if (sizeMatches && colorMatches) {
              await supabase.from('cart_items').delete().eq('id', row.id);
            }
          }
        }
      } catch (err) {
        console.error("Error removing from Supabase cart:", err);
      }
    }
  };

  const updateQuantity = async (productId: string, size: string, quantity: number, color?: string) => {
    if (!productId) return;
    if (quantity <= 0) {
      removeFromCart(productId, size, color);
      return;
    }
    const cleanQty = isNaN(Number(quantity)) || Number(quantity) < 1 ? 1 : Number(quantity);
    const safeSize = (size || '').trim().toLowerCase();
    const safeColor = (color || '').trim().toLowerCase();
    
    setItems(prev => {
      const safePrev = Array.isArray(prev) ? prev.filter(Boolean) : [];
      const updated = safePrev.map(i => {
        if (i && i.id === productId && (i.selectedSize || '').trim().toLowerCase() === safeSize && (i.selectedColor || '').trim().toLowerCase() === safeColor) {
          const productStockValue = i.stock !== undefined && i.stock !== null ? Number(i.stock) : 99;
          const stockLimit = isNaN(productStockValue) ? 99 : productStockValue;
          const finalQuantity = Math.min(stockLimit, cleanQty);
          return { ...i, quantity: finalQuantity };
        }
        return i;
      });

      try {
        localStorage.setItem('ruby_cart', JSON.stringify(updated));
      } catch (e) {}

      return updated;
    });

    const userId = user?.id || user?.uid || (user as any)?.sub;
    if (userId) {
      try {
        const { data: existingData } = await supabase
          .from('cart_items')
          .select('id, stock:products(stock)')
          .eq('user_id', userId)
          .eq('product_id', productId)
          .eq('size', size)
          .eq('color', color || '')
          .maybeSingle();

        if (existingData) {
          const nestedProduct = Array.isArray(existingData.stock) ? existingData.stock[0] : existingData.stock;
          const productStockValue = nestedProduct && nestedProduct.stock !== undefined ? Number(nestedProduct.stock) : 99;
          const stockLimit = isNaN(productStockValue) ? 99 : productStockValue;
          const finalQuantity = Math.min(stockLimit, cleanQty);

          await supabase
            .from('cart_items')
            .update({ quantity: finalQuantity, updated_at: new Date().toISOString() })
            .eq('id', existingData.id);
        }
      } catch (err) {
        console.error("Error updating quantity in Supabase cart:", err);
      }
    }
  };

  const clearCart = async () => {
    // Add all current items to tombstones so they cannot resurrect
    for (const item of items) {
      if (item && item.id) {
        addRemovedTombstone(item.id, item.selectedSize, item.selectedColor);
      }
    }

    setItems([]);
    setAppliedPromo(null);
    try {
      localStorage.setItem('ruby_cart', JSON.stringify([]));
    } catch (e) {}

    const userId = user?.id || user?.uid || (user as any)?.sub;
    if (userId) {
      try {
        await supabase
          .from('cart_items')
          .delete()
          .eq('user_id', userId);
      } catch (err) {
        console.error("Error clearing Supabase cart:", err);
      }
    }
  };

  const { settings } = useSettings();

  const calculateTotals = () => {
    let subtotal = 0;
    let promoDiscount = 0;
    let autoOfferDiscount = 0;

    const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

    safeItems.forEach(item => {
      const price = Number(item.price);
      const qty = isNaN(Number(item.quantity)) ? 1 : Number(item.quantity);
      if (!isNaN(price)) {
        subtotal += price * qty;
      }
    });

    // Strategy 1: Legacy Settings-based Discounts (Optional/Fallback)
    if (settings?.buy2Get1Free) {
      safeItems.forEach(item => {
        const qty = isNaN(Number(item.quantity)) ? 0 : Number(item.quantity);
        const freeItems = Math.floor(qty / 3);
        const price = Number(item.price) || 0;
        autoOfferDiscount += freeItems * price;
      });
    } else if (settings?.buy2GetPercentEnabled && settings?.buy2GetPercentOff) {
      safeItems.forEach(item => {
        const qty = isNaN(Number(item.quantity)) ? 0 : Number(item.quantity);
        if (qty >= 2) {
          const discountRate = (Number(settings.buy2GetPercentOff) || 0) / 100;
          const price = Number(item.price) || 0;
          autoOfferDiscount += (price * qty) * discountRate;
        }
      });
    }

    // Strategy 2: Advanced Promotion Engine Logic
    let hasAppliedStackable = false;
    if (Array.isArray(promotions)) {
      const activePromotions = promotions.filter(Boolean);
      activePromotions.forEach(promo => {
        if (!promo) return;
        // 1. Check stackability
        if (!promo.stackable && hasAppliedStackable) return;

        // 2. Initial Conditions
        const cartTotal = subtotal;
        const cartQty = safeItems.reduce((sum, i) => sum + (isNaN(Number(i.quantity)) ? 1 : Number(i.quantity)), 0);

        const conditions = promo.conditions || {};
        const meetsValue = conditions.minCartValue ? (cartTotal >= conditions.minCartValue) : true;
        const meetsQty = conditions.minQuantity ? (cartQty >= conditions.minQuantity) : true;

        if (meetsValue && meetsQty) {
          let promoAppliedValue = 0;

          if (promo.type === 'bxgy') {
            const bxgyConfig = promo.bxgyConfig || {};
            safeItems.forEach(item => {
              const buyQty = Number(bxgyConfig.buyQty) || 2;
              const getQty = Number(bxgyConfig.getQty) || 1;
              const itemQty = isNaN(Number(item.quantity)) ? 0 : Number(item.quantity);
              const sets = Math.floor(itemQty / (buyQty + getQty));
              if (sets > 0) {
                const freeQty = sets * getQty;
                promoAppliedValue += freeQty * (Number(item.price) || 0);
              }
            });
          } else if (promo.type === 'percentage') {
            const reward = promo.reward || {};
            const rewardValue = Number(reward.value) || 0;
            promoAppliedValue = (cartTotal * rewardValue) / 100;
          } else if (promo.type === 'flat') {
            const reward = promo.reward || {};
            promoAppliedValue = Number(reward.value) || 0;
          }

          // Apply Limits
          const limits = promo.limits || {};
          if (limits.maxDiscount && promoAppliedValue > limits.maxDiscount) {
            promoAppliedValue = limits.maxDiscount;
          }

          if (promoAppliedValue > 0) {
            autoOfferDiscount += promoAppliedValue;
            if (!promo.stackable) hasAppliedStackable = true;
          }
        }
      });
    }

    if (appliedPromo) {
      promoDiscount = Number(appliedPromo.discount) || 0;
    }

    const totalDiscount = promoDiscount + autoOfferDiscount;
    const finalTotal = Math.max(0, subtotal - totalDiscount);

    return { subtotal, totalDiscount, autoOfferDiscount, promoDiscount, finalTotal };
  };

  const { subtotal, totalDiscount, autoOfferDiscount, promoDiscount, finalTotal: total } = calculateTotals();
  const itemCount = Array.isArray(items) ? items.filter(Boolean).reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0) : 0;

  return (
    <CartContext.Provider value={{ 
      items, 
      addToCart, 
      removeFromCart, 
      updateQuantity, 
      clearCart, 
      total, 
      subtotal,
      totalDiscount,
      autoOfferDiscount,
      promoDiscount,
      itemCount,
      appliedPromo,
      setAppliedPromo
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};
