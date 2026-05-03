import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem, Product } from '../types';

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, size: string, color?: string, quantity?: number) => void;
  removeFromCart: (productId: string, size: string, color?: string) => void;
  updateQuantity: (productId: string, size: string, quantity: number, color?: string) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
  appliedPromo: { code: string; discount: number } | null;
  setAppliedPromo: (promo: { code: string; discount: number } | null) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('ruby_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(null);

  useEffect(() => {
    localStorage.setItem('ruby_cart', JSON.stringify(items));
  }, [items]);

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

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ 
      items, 
      addToCart, 
      removeFromCart, 
      updateQuantity, 
      clearCart, 
      total, 
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
