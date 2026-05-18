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
    const saved = localStorage.getItem('ruby_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  useEffect(() => {
    localStorage.setItem('ruby_cart', JSON.stringify(items));
    
    // Abandoned Cart Tracking Logic
    if (user) {
      const syncCartToFirestore = async () => {
        try {
          if (items.length > 0) {
            await setDoc(doc(db, 'carts', user.uid), {
              userId: user.uid,
              userName: user.displayName || 'Guest',
              userEmail: user.email,
              items: items.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                selectedSize: item.selectedSize,
                selectedColor: item.selectedColor,
                image: item.images[0]
              })),
              total: items.reduce((sum, i) => sum + (i.price * i.quantity), 0),
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
    setItems(prev => {
      const existing = prev.find(i => 
        i.id === product.id && 
        i.selectedSize === size && 
        i.selectedColor === color
      );
      if (existing) {
        const newQuantity = Math.min(product.stock, existing.quantity + quantity);
        return prev.map(i => 
          (i.id === product.id && i.selectedSize === size && i.selectedColor === color) 
            ? { ...i, quantity: newQuantity } 
            : i
        );
      }
      const initialQuantity = Math.min(product.stock, quantity);
      return [...prev, { ...product, selectedSize: size, selectedColor: color, quantity: initialQuantity }];
    });
  };

  const removeFromCart = (productId: string, size: string, color?: string) => {
    setItems(prev => prev.filter(i => 
      !(i.id === productId && i.selectedSize === size && i.selectedColor === color)
    ));
  };

  const updateQuantity = (productId: string, size: string, quantity: number, color?: string) => {
    if (quantity < 1) return;
    setItems(prev => prev.map(i => {
      if (i.id === productId && i.selectedSize === size && i.selectedColor === color) {
        const finalQuantity = Math.min(i.stock, quantity);
        return { ...i, quantity: finalQuantity };
      }
      return i;
    }));
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

    items.forEach(item => {
      const price = Number(item.price);
      if (!isNaN(price)) {
        subtotal += price * item.quantity;
      }
    });

    // Strategy 1: Legacy Settings-based Discounts (Optional/Fallback)
    if (settings?.buy2Get1Free) {
      items.forEach(item => {
        const freeItems = Math.floor(item.quantity / 3);
        autoOfferDiscount += freeItems * item.price;
      });
    } else if (settings?.buy2GetPercentEnabled && settings?.buy2GetPercentOff) {
      items.forEach(item => {
        if (item.quantity >= 2) {
          const discountRate = settings.buy2GetPercentOff / 100;
          autoOfferDiscount += (item.price * item.quantity) * discountRate;
        }
      });
    }

    // Strategy 2: Advanced Promotion Engine Logic
    let hasAppliedStackable = false;
    promotions.forEach(promo => {
      // 1. Check stackability
      if (!promo.stackable && hasAppliedStackable) return;

      // 2. Initial Conditions
      const cartTotal = subtotal;
      const cartQty = items.reduce((sum, i) => sum + i.quantity, 0);

      const meetsValue = promo.conditions.minCartValue ? (cartTotal >= promo.conditions.minCartValue) : true;
      const meetsQty = promo.conditions.minQuantity ? (cartQty >= promo.conditions.minQuantity) : true;

      // TODO: Add Product/Category specific filters here
      
      if (meetsValue && meetsQty) {
        let promoAppliedValue = 0;

        if (promo.type === 'bxgy') {
          items.forEach(item => {
            const buyQty = promo.bxgyConfig?.buyQty || 2;
            const getQty = promo.bxgyConfig?.getQty || 1;
            const sets = Math.floor(item.quantity / (buyQty + getQty));
            if (sets > 0) {
              const freeQty = sets * getQty;
              promoAppliedValue += freeQty * item.price;
            }
          });
        } else if (promo.type === 'percentage') {
          const rewardValue = promo.reward.value || 0;
          promoAppliedValue = (cartTotal * rewardValue) / 100;
        } else if (promo.type === 'flat') {
          promoAppliedValue = promo.reward.value || 0;
        }

        // Apply Limits
        if (promo.limits.maxDiscount && promoAppliedValue > promo.limits.maxDiscount) {
          promoAppliedValue = promo.limits.maxDiscount;
        }

        if (promoAppliedValue > 0) {
          autoOfferDiscount += promoAppliedValue;
          if (!promo.stackable) hasAppliedStackable = true;
        }
      }
    });

    if (appliedPromo) {
      promoDiscount = appliedPromo.discount;
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
