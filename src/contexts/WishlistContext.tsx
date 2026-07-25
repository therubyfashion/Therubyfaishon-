import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Product } from '../types';
import { supabase } from '../supabase';
import { useAuth } from './AuthContext';

interface WishlistContextType {
  items: Product[];
  toggleWishlist: (product: Product) => void;
  isInWishlist: (productId: string) => boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<Product[]>([]);
  const { user, loading: authLoading } = useAuth();
  const lastFetchedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setItems([]);
      lastFetchedUserId.current = null;
      return;
    }

    if (lastFetchedUserId.current === user.uid) {
      return;
    }

    const fetchWishlist = async () => {
      try {
        const { data, error } = await supabase
          .from('wishlist_items')
          .select('*, products(*)')
          .eq('user_id', user.uid);

        if (error) {
          console.error("Error fetching wishlist items from Supabase:", error);
          return;
        }

        const dbItems: Product[] = (data || []).map(row => {
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
          } as Product;
        }).filter(Boolean) as Product[];

        setItems(dbItems);
        lastFetchedUserId.current = user.uid;
        
        // Clean up legacy guest wishlist
        localStorage.removeItem('ruby_wishlist');
      } catch (err) {
        console.error("Error in fetchWishlist:", err);
      }
    };

    fetchWishlist();
  }, [user, authLoading]);

  const toggleWishlist = async (product: Product) => {
    if (!product || !product.id || !user) return;
    
    const isCurrentlyInWishlist = items.some(i => i.id === product.id);
    
    if (isCurrentlyInWishlist) {
      setItems(prev => prev.filter(i => i.id !== product.id));
      try {
        await supabase
          .from('wishlist_items')
          .delete()
          .eq('user_id', user.uid)
          .eq('product_id', product.id);
      } catch (err) {
        console.error("Error deleting from wishlist_items:", err);
      }
    } else {
      setItems(prev => [...prev, product]);
      try {
        await supabase
          .from('wishlist_items')
          .insert({
            user_id: user.uid,
            product_id: product.id,
            created_at: new Date().toISOString()
          });
      } catch (err) {
        console.error("Error inserting into wishlist_items:", err);
      }
    }
  };

  const isInWishlist = (productId: string) => {
    if (!productId || !Array.isArray(items)) return false;
    return items.some(i => i && i.id === productId);
  };

  return (
    <WishlistContext.Provider value={{ items: items || [], toggleWishlist, isInWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used within WishlistProvider');
  return context;
};
