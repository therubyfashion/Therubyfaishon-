import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product } from '../types';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';

interface WishlistContextType {
  items: Product[];
  toggleWishlist: (product: Product) => void;
  isInWishlist: (productId: string) => boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<Product[]>(() => {
    const saved = localStorage.getItem('ruby_wishlist');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('ruby_wishlist', JSON.stringify(items));
  }, [items]);

  const toggleWishlist = async (product: Product) => {
    const exists = items.find(i => i.id === product.id);
    
    if (exists) {
      setItems(prev => prev.filter(i => i.id !== product.id));
    } else {
      setItems(prev => [...prev, product]);
    }
  };

  const isInWishlist = (productId: string) => items.some(i => i.id === productId);

  return (
    <WishlistContext.Provider value={{ items, toggleWishlist, isInWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used within WishlistProvider');
  return context;
};
