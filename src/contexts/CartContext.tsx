import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
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

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('ruby_cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
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
        // 1. Fetch existing cart items from Supabase
        const { data: dbItemsData, error: dbItemsErr } = await supabase
          .from('cart_items')
          .select('*, products(*)')
          .eq('user_id', user.uid);

        if (dbItemsErr) {
          console.error("Error fetching cart items from Supabase:", dbItemsErr);
          setCartLoaded(true);
          return;
        }

        // Parse db items
        const dbItems: CartItem[] = (dbItemsData || []).map(row => {
          const p = Array.isArray(row.products) ? row.products[0] : row.products;
          if (!p) return null;
          
          return {
            ...p,
            id: p.id,
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
            
            selectedSize: row.size || '',
            selectedColor: row.color || '',
            quantity: Number(row.quantity) || 1
          } as CartItem;
        }).filter(Boolean) as CartItem[];

        // 2. Read local guest items
        const localSaved = localStorage.getItem('ruby_cart');
        let localItems: CartItem[] = [];
        if (localSaved) {
          try {
            const parsed = JSON.parse(localSaved);
            if (Array.isArray(parsed)) {
              localItems = parsed.filter(Boolean);
            }
          } catch (e) {
            console.warn("Failed to parse local cart:", e);
          }
        }

        if (localItems.length > 0) {
          console.log("Merging guest cart into Supabase cart...");
          const mergedList = [...dbItems];

          for (const localItem of localItems) {
            const existingIndex = mergedList.findIndex(i =>
              i.id === localItem.id &&
              i.selectedSize === localItem.selectedSize &&
              i.selectedColor === localItem.selectedColor
            );

            if (existingIndex !== -1) {
              const newQty = Math.max(mergedList[existingIndex].quantity, localItem.quantity);
              mergedList[existingIndex].quantity = newQty;

              const dbRow = dbItemsData?.find(r => 
                r.product_id === localItem.id &&
                r.size === localItem.selectedSize &&
                r.color === (localItem.selectedColor || '')
              );
              if (dbRow) {
                await supabase
                  .from('cart_items')
                  .update({ quantity: newQty, updated_at: new Date().toISOString() })
                  .eq('id', dbRow.id);
              }
            } else {
              mergedList.push(localItem);

              await supabase
                .from('cart_items')
                .insert({
                  user_id: user.uid,
                  product_id: localItem.id,
                  size: localItem.selectedSize,
                  color: localItem.selectedColor || '',
                  quantity: localItem.quantity,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });
            }
          }

          setItems(mergedList);
          localStorage.removeItem('ruby_cart');
        } else {
          setItems(dbItems);
        }

        lastFetchedUserId.current = user.uid;
      } catch (err) {
        console.error("Error loading/merging cart from Supabase:", err);
      } finally {
        setCartLoaded(true);
      }
    };

    setCartLoaded(false);
    fetchAndMergeCart();
  }, [user, authLoading]);

  // Save guest cart state locally
  useEffect(() => {
    if (!user && Array.isArray(items)) {
      try {
        localStorage.setItem('ruby_cart', JSON.stringify(items.filter(Boolean)));
      } catch (err) {
        console.warn("⚠️ LocalStorage quota exceeded, could not save cart state locally:", err);
      }
    }
  }, [items, user]);

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
    
    setItems(prev => {
      const safePrev = Array.isArray(prev) ? prev.filter(Boolean) : [];
      const existing = safePrev.find(i => 
        i && i.id === product.id && 
        i.selectedSize === size && 
        i.selectedColor === color
      );
      if (existing) {
        const existingQty = isNaN(Number(existing.quantity)) ? 1 : Number(existing.quantity);
        const newQuantity = Math.min(stockLimit, existingQty + safeQuantity);
        
        return safePrev.map(i => 
          (i && i.id === product.id && i.selectedSize === size && i.selectedColor === color) 
            ? { ...i, quantity: newQuantity } 
            : i
        );
      }
      const initialQuantity = Math.min(stockLimit, safeQuantity);
      return [...safePrev, { ...product, selectedSize: size, selectedColor: color, quantity: initialQuantity }];
    });

    if (user) {
      try {
        const { data: existingData } = await supabase
          .from('cart_items')
          .select('id, quantity')
          .eq('user_id', user.uid)
          .eq('product_id', product.id)
          .eq('size', size)
          .eq('color', color || '')
          .maybeSingle();

        if (existingData) {
          const newQty = Math.min(stockLimit, (existingData.quantity || 1) + safeQuantity);
          await supabase
            .from('cart_items')
            .update({ quantity: newQty, updated_at: new Date().toISOString() })
            .eq('id', existingData.id);
        } else {
          const initialQuantity = Math.min(stockLimit, safeQuantity);
          await supabase
            .from('cart_items')
            .insert({
              user_id: user.uid,
              product_id: product.id,
              size: size,
              color: color || '',
              quantity: initialQuantity,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
        }
      } catch (err) {
        console.error("Error adding to Supabase cart:", err);
      }
    }
  };

  const removeFromCart = async (productId: string, size: string, color?: string) => {
    if (!productId) return;
    setItems(prev => {
      const safePrev = Array.isArray(prev) ? prev.filter(Boolean) : [];
      return safePrev.filter(i => 
        !(i && i.id === productId && i.selectedSize === size && i.selectedColor === color)
      );
    });

    if (user) {
      try {
        await supabase
          .from('cart_items')
          .delete()
          .eq('user_id', user.uid)
          .eq('product_id', productId)
          .eq('size', size)
          .eq('color', color || '');
      } catch (err) {
        console.error("Error removing from Supabase cart:", err);
      }
    }
  };

  const updateQuantity = async (productId: string, size: string, quantity: number, color?: string) => {
    if (!productId) return;
    const cleanQty = isNaN(Number(quantity)) || Number(quantity) < 1 ? 1 : Number(quantity);
    
    setItems(prev => {
      const safePrev = Array.isArray(prev) ? prev.filter(Boolean) : [];
      return safePrev.map(i => {
        if (i && i.id === productId && i.selectedSize === size && i.selectedColor === color) {
          const productStockValue = i.stock !== undefined && i.stock !== null ? Number(i.stock) : 99;
          const stockLimit = isNaN(productStockValue) ? 99 : productStockValue;
          const finalQuantity = Math.min(stockLimit, cleanQty);
          return { ...i, quantity: finalQuantity };
        }
        return i;
      });
    });

    if (user) {
      try {
        const { data: existingData } = await supabase
          .from('cart_items')
          .select('id, stock:products(stock)')
          .eq('user_id', user.uid)
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
    setItems([]);
    setAppliedPromo(null);

    if (user) {
      try {
        await supabase
          .from('cart_items')
          .delete()
          .eq('user_id', user.uid);
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
