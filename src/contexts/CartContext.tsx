import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, setDoc, doc, serverTimestamp, deleteDoc } from 'firebase/firestore';
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
  const { user } = useAuth();
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

  useEffect(() => {
    if (Array.isArray(items)) {
      localStorage.setItem('ruby_cart', JSON.stringify(items.filter(Boolean)));
    }
    
    // Abandoned Cart Tracking Logic
    if (user && Array.isArray(items)) {
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
            // If cart becomes empty, remove from Firestore
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
  }, [items, user]);

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
      } catch (error) {
        console.error("Error fetching promotions in checkout:", error);
      }
    };
    fetchActivePromotions();
  }, []);

  const addToCart = (product: Product, size: string, color?: string, quantity: number = 1) => {
    if (!product || !product.id) return;
    setItems(prev => {
      const safePrev = Array.isArray(prev) ? prev.filter(Boolean) : [];
      const existing = safePrev.find(i => 
        i && i.id === product.id && 
        i.selectedSize === size && 
        i.selectedColor === color
      );
      if (existing) {
        const stockLimit = (product.stock !== undefined && product.stock !== null) ? Number(product.stock) : 99;
        const newQuantity = Math.min(stockLimit, existing.quantity + quantity);
        return safePrev.map(i => 
          (i && i.id === product.id && i.selectedSize === size && i.selectedColor === color) 
            ? { ...i, quantity: newQuantity } 
            : i
        );
      }
      const stockLimit = (product.stock !== undefined && product.stock !== null) ? Number(product.stock) : 99;
      const initialQuantity = Math.min(stockLimit, quantity);
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
    if (!productId || quantity < 1) return;
    setItems(prev => {
      const safePrev = Array.isArray(prev) ? prev.filter(Boolean) : [];
      return safePrev.map(i => {
        if (i && i.id === productId && i.selectedSize === size && i.selectedColor === color) {
          const stockLimit = (i.stock !== undefined && i.stock !== null) ? Number(i.stock) : 99;
          const finalQuantity = Math.min(stockLimit, quantity);
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

    if (Array.isArray(items)) {
      items.forEach(item => {
        if (!item) return;
        const price = Number(item.price);
        if (!isNaN(price)) {
          subtotal += price * (Number(item.quantity) || 1);
        }
      });
    }

    // Strategy 1: Legacy Settings-based Discounts (Optional/Fallback)
    if (settings?.buy2Get1Free && Array.isArray(items)) {
      items.forEach(item => {
        if (!item) return;
        const freeItems = Math.floor((Number(item.quantity) || 0) / 3);
        autoOfferDiscount += freeItems * (Number(item.price) || 0);
      });
    } else if (settings?.buy2GetPercentEnabled && settings?.buy2GetPercentOff && Array.isArray(items)) {
      items.forEach(item => {
        if (!item) return;
        const qty = Number(item.quantity) || 0;
        if (qty >= 2) {
          const discountRate = (Number(settings.buy2GetPercentOff) || 0) / 100;
          autoOfferDiscount += ((Number(item.price) || 0) * qty) * discountRate;
        }
      });
    }

    // Strategy 2: Advanced Promotion Engine Logic
    let hasAppliedStackable = false;
    if (Array.isArray(promotions) && Array.isArray(items)) {
      promotions.forEach(promo => {
        if (!promo) return;
        // 1. Check stackability
        if (!promo.stackable && hasAppliedStackable) return;

        // 2. Initial Conditions
        const cartTotal = subtotal;
        const cartQty = items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);

        const conditions = promo.conditions || {};
        const meetsValue = conditions.minCartValue ? (cartTotal >= conditions.minCartValue) : true;
        const meetsQty = conditions.minQuantity ? (cartQty >= conditions.minQuantity) : true;

        if (meetsValue && meetsQty) {
          let promoAppliedValue = 0;

          if (promo.type === 'bxgy') {
            const bxgyConfig = promo.bxgyConfig || {};
            items.forEach(item => {
              if (!item) return;
              const buyQty = Number(bxgyConfig.buyQty) || 2;
              const getQty = Number(bxgyConfig.getQty) || 1;
              const itemQty = Number(item.quantity) || 0;
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
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

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
