import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, getDocs, getDoc, orderBy, setDoc, doc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CartItem, Product, Promotion } from '../types';
import { useSettings } from './SettingsContext';
import { useAuth } from './AuthContext';

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

  // Load and Merge cart from Firestore on user/auth state resolution
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setCartLoaded(true);
      return;
    }

    const fetchAndMergeCart = async () => {
      try {
        const docRef = doc(db, 'carts', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const dbItems = Array.isArray(data?.items) ? data.items : [];
          
          if (dbItems.length > 0) {
            setItems(prev => {
              const safePrev = Array.isArray(prev) ? prev.filter(Boolean) : [];
              const merged = [...safePrev];
              
              dbItems.forEach((dbItem: any) => {
                if (!dbItem || !dbItem.id) return;
                
                const existingIndex = merged.findIndex(i => 
                  i && i.id === dbItem.id && 
                  i.selectedSize === dbItem.selectedSize && 
                  i.selectedColor === dbItem.selectedColor
                );
                
                if (existingIndex !== -1) {
                  // Keep larger quantity to avoid wiping progress
                  merged[existingIndex].quantity = Math.max(
                    Number(merged[existingIndex].quantity) || 1,
                    Number(dbItem.quantity) || 1
                  );
                } else {
                  // Add database item as it was not in the local cart
                  merged.push({
                    id: dbItem.id,
                    name: dbItem.name || '',
                    price: Number(dbItem.price) || 0,
                    quantity: Number(dbItem.quantity) || 1,
                    selectedSize: dbItem.selectedSize || '',
                    selectedColor: dbItem.selectedColor || '',
                    images: dbItem.image ? [dbItem.image] : [],
                    category: dbItem.category || '',
                    stock: dbItem.stock !== undefined ? dbItem.stock : 99
                  } as any);
                }
              });
              
              return merged;
            });
          }
        }
      } catch (err) {
        console.error("Error loading/merging cart from Firestore:", err);
      } finally {
        setCartLoaded(true);
      }
    };

    setCartLoaded(false);
    fetchAndMergeCart();
  }, [user, authLoading]);

  useEffect(() => {
    if (Array.isArray(items)) {
      try {
        localStorage.setItem('ruby_cart', JSON.stringify(items.filter(Boolean)));
      } catch (err) {
        console.warn("⚠️ LocalStorage quota exceeded, could not save cart state locally:", err);
      }
    }
    
    // Abandoned Cart Tracking Logic - Only sync to database after Firestore load is fully completed
    if (cartLoaded && user && Array.isArray(items)) {
      const syncCartToFirestore = async () => {
        try {
          const validItems = items.filter(Boolean);
          if (validItems.length > 0) {
            await setDoc(doc(db, 'carts', user.uid), {
              userId: user.uid,
              userName: user.displayName || 'Guest',
              userEmail: user.email,
              items: validItems.map(item => ({
                id: item.id || '',
                name: item.name || '',
                price: Number(item.price) || 0,
                quantity: Number(item.quantity) || 1,
                selectedSize: item.selectedSize || '',
                selectedColor: item.selectedColor || '',
                image: (item.images && item.images.length > 0) ? item.images[0] : ''
              })),
              total: validItems.reduce((sum, i) => sum + ((Number(i.price) || 0) * (Number(i.quantity) || 1)), 0),
              updatedAt: serverTimestamp(),
              status: 'active'
            });
          } else {
            // If cart becomes empty (after load was complete), remove from Firestore
            await deleteDoc(doc(db, 'carts', user.uid));
          }
        } catch (e) {
          console.error("Error syncing cart to Firestore:", e);
        }
      };
      
      // Debounce sync slightly
      const timer = setTimeout(syncCartToFirestore, 1000);
      return () => clearTimeout(timer);
    }
  }, [items, user, cartLoaded]);

  useEffect(() => {
    const fetchActivePromotions = async () => {
      try {
        const q = query(
          collection(db, 'promotions'),
          where('status', '==', 'active'),
          orderBy('priority', 'asc')
        );
        const snap = await getDocs(q);
        setPromotions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Promotion)));
      } catch (error: any) {
        console.error("Error fetching promotions in checkout:", error);
        const errMsg = String(error?.message || error || '').toLowerCase();
        if (
          error?.code === 'resource-exhausted' ||
          errMsg.includes('quota exceeded') ||
          errMsg.includes('quota-exceeded') ||
          errMsg.includes('resource-exhausted') ||
          errMsg.includes('free daily read units per project')
        ) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('firestore-quota-exceeded'));
          }
        }
      }
    };
    fetchActivePromotions();
  }, []);

  const addToCart = (product: Product, size: string, color?: string, quantity: number = 1) => {
    if (!product || !product.id) return;
    const safeQuantity = isNaN(Number(quantity)) || Number(quantity) < 1 ? 1 : Number(quantity);
    
    setItems(prev => {
      const safePrev = Array.isArray(prev) ? prev.filter(Boolean) : [];
      const existing = safePrev.find(i => 
        i && i.id === product.id && 
        i.selectedSize === size && 
        i.selectedColor === color
      );
      if (existing) {
        const productStockValue = product.stock !== undefined && product.stock !== null ? Number(product.stock) : 99;
        const stockLimit = isNaN(productStockValue) ? 99 : productStockValue;
        const existingQty = isNaN(Number(existing.quantity)) ? 1 : Number(existing.quantity);
        const newQuantity = Math.min(stockLimit, existingQty + safeQuantity);
        
        return safePrev.map(i => 
          (i && i.id === product.id && i.selectedSize === size && i.selectedColor === color) 
            ? { ...i, quantity: newQuantity } 
            : i
        );
      }
      const productStockValue = product.stock !== undefined && product.stock !== null ? Number(product.stock) : 99;
      const stockLimit = isNaN(productStockValue) ? 99 : productStockValue;
      const initialQuantity = Math.min(stockLimit, safeQuantity);
      return [...safePrev, { ...product, selectedSize: size, selectedColor: color, quantity: initialQuantity }];
    });
  };

  const removeFromCart = (productId: string, size: string, color?: string) => {
    if (!productId) return;
    setItems(prev => {
      const safePrev = Array.isArray(prev) ? prev.filter(Boolean) : [];
      return safePrev.filter(i => 
        !(i && i.id === productId && i.selectedSize === size && i.selectedColor === color)
      );
    });
  };

  const updateQuantity = (productId: string, size: string, quantity: number, color?: string) => {
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
  };

  const clearCart = () => {
    setItems([]);
    setAppliedPromo(null);
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
