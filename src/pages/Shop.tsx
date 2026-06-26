import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Product, Category } from '../types';

import ProductCard from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/Skeleton';
import { Filter, ChevronDown, SlidersHorizontal, Truck, RefreshCw, ShieldCheck } from 'lucide-react';
import { checkProductHealth, logProductDiagnostics } from '../utils/productHealthCheck';

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [activeCategory, setActiveCategory] = useState<string>(
    searchParams.get('category') || 'All'
  );
  const [sortBy, setSortBy] = useState<'newest' | 'price-low' | 'price-high'>('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const sortOptions = [
    { id: 'newest', label: 'Newest' },
    { id: 'price-low', label: 'Price: Low to High' },
    { id: 'price-high', label: 'Price: High to Low' },
  ];

  // Preload from cache where available to load instantly
  useEffect(() => {
    try {
      const cacheKey = `ruby_shop_cache_${activeCategory}_${sortBy}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Clean cache of old fallback items to prevent flash of dummy data
        const hasDummy = (parsed.products && parsed.products.some((p: any) => p.id && p.id.startsWith('fp'))) ||
                         (parsed.categories && parsed.categories.some((c: any) => c !== 'All' && !c.match(/^[A-Z]/)));
        if (hasDummy) {
          localStorage.removeItem(cacheKey);
        } else {
          if (parsed.products) setProducts(parsed.products);
          if (parsed.categories) setCategories(parsed.categories);
          setLoading(false);
        }
      }
    } catch (e) {
      console.warn("Failed to load shop cache:", e);
    }
  }, [activeCategory, sortBy]);

  useEffect(() => {
    const cacheKey = `ruby_shop_cache_${activeCategory}_${sortBy}`;
    const hasCache = localStorage.getItem(cacheKey) !== null;
    if (!hasCache && products.length === 0) {
      setLoading(true);
    }

    let finalCategories: string[] = ['All'];
    let fetchedProducts: Product[] = [];

    const saveToCache = (key: 'products' | 'categories', data: any) => {
      try {
        const cached = localStorage.getItem(cacheKey);
        const parsed = cached ? JSON.parse(cached) : {};
        parsed[key] = data;
        parsed.savedAt = Date.now();
        localStorage.setItem(cacheKey, JSON.stringify(parsed));
      } catch (e) {
        console.warn("Failed to write shop cache:", e);
      }
    };

    // 1. Categories real-time sync
    const unsubscribeCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      const sortedCategoryDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      sortedCategoryDocs.sort((a, b) => {
        const orderA = a.sortOrder !== undefined ? Number(a.sortOrder) : 1000;
        const orderB = b.sortOrder !== undefined ? Number(b.sortOrder) : 1000;
        return orderA - orderB;
      });
      const catNames = sortedCategoryDocs.map(c => c.name);
      finalCategories = ['All', ...catNames];
      setCategories(finalCategories);
      saveToCache('categories', finalCategories);
    }, (error) => {
      console.warn("Shop categories real-time error:", error);
      setCategories(['All']);
      unsubscribeCategories();
    });

    // 2. Products real-time sync - resilient querying & client filtering to avoid missing index crashes
    const productsQuery = query(
      collection(db, 'products'), 
      orderBy('createdAt', 'desc'), 
      limit(200)
    );

    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      let rawProds = snapshot.docs.map(doc => {
        const prod = {
          id: doc.id,
          ...(doc.data() as Omit<Product, 'id'>)
        } as Product;
        logProductDiagnostics('Fetched', prod);
        return prod;
      });

      console.log(`[Product Diagnostic - Query Result Count] Total products fetched from Firestore: ${rawProds.length}`);

      if (rawProds.length === 0) {
        rawProds = [];
      }

      // Client-side category filtering with fallback resilience (supports both category as array or string)
      let prods = rawProds.filter(p => {
        if (activeCategory === 'All') return true;
        const matches = Array.isArray(p.category)
          ? p.category.includes(activeCategory)
          : p.category === activeCategory;
        
        if (!matches) {
          logProductDiagnostics('Hidden', p, `Category mismatch. Product category: ${JSON.stringify(p.category)}, active category: "${activeCategory}"`);
        }
        return matches;
      });

      // Run health checks & diagnostics
      prods.forEach(p => {
        const health = checkProductHealth(p);
        if (!health.isValid) {
          console.warn(`[Product Diagnostic - Health Check Warning] Product "${p.name}" (${p.id}) has health issues:`, health.errors, health.warnings);
        }
        logProductDiagnostics('Rendered', p);
      });

      // Client-side sorting
      prods.sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        }
        if (sortBy === 'price-low') {
          return a.price - b.price;
        }
        if (sortBy === 'price-high') {
          return b.price - a.price;
        }
        return 0;
      });

      fetchedProducts = prods;
      setProducts(prods);
      setLoading(false);
      saveToCache('products', prods);
    }, (error) => {
      console.warn("Shop products real-time error:", error);
      setProducts([]);
      setLoading(false);
      unsubscribeProducts();
    });

    return () => {
      unsubscribeCategories();
      unsubscribeProducts();
    };
  }, [activeCategory, sortBy]);

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    if (cat === 'All') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', cat);
    }
    setSearchParams(searchParams);
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header - Centered */}
        <div className="flex flex-col items-center text-center mb-16 space-y-8">
          <div className="space-y-3">
            <h1 className="text-5xl font-serif font-bold tracking-tight text-[#1A2C54]">The Collection</h1>
            <p className="text-gray-500 text-sm font-light tracking-widest uppercase">Refined styles for every occasion.</p>
          </div>
          
          <div className="flex items-center justify-center space-x-8 text-[11px] font-bold uppercase tracking-[0.2em] border-b border-gray-100 pb-2 w-full max-w-2xl overflow-x-auto scrollbar-hide">
            {categories.map(cat => (
              <button 
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`pb-2 transition-all relative whitespace-nowrap ${activeCategory === cat ? 'text-ruby' : 'text-gray-400 hover:text-black'}`}
              >
                {cat}
                {activeCategory === cat && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-ruby" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Filters & Sorting Bar */}
        <div className="flex justify-between items-center mb-12 py-5 border-y border-gray-100">
          <div className="flex items-center space-x-4 text-[11px] font-black uppercase tracking-widest text-[#1A2C54]">
            <SlidersHorizontal size={16} className="text-ruby" />
            <span>Filter</span>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center space-x-2 text-[11px] font-black uppercase tracking-widest text-[#1A2C54] cursor-pointer hover:text-ruby transition-colors"
            >
              <span>Sort By: {sortOptions.find(o => o.id === sortBy)?.label}</span>
              <ChevronDown size={14} className={`transition-transform duration-300 ${showSortMenu ? 'rotate-180' : ''}`} />
            </button>

            {showSortMenu && (
              <>
                <div 
                  className="fixed inset-0 z-20" 
                  onClick={() => setShowSortMenu(false)}
                />
                <div className="absolute right-0 mt-4 w-56 bg-white border border-gray-100 shadow-2xl rounded-xl py-2 z-30 animate-in fade-in zoom-in duration-200">
                  {sortOptions.map(option => (
                    <button
                      key={option.id}
                      onClick={() => {
                        setSortBy(option.id as any);
                        setShowSortMenu(false);
                      }}
                      className={`w-full text-left px-6 py-3 text-[11px] font-bold uppercase tracking-widest transition-colors ${sortBy === option.id ? 'text-ruby bg-ruby/5' : 'text-gray-500 hover:bg-gray-50 hover:text-black'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
            {[...Array(8)].map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="products-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 lg:gap-8">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 space-y-6">
            <p className="text-gray-400 font-serif italic text-xl">No products found in this category.</p>
            <button 
              onClick={() => handleCategoryChange('All')}
              className="text-xs font-bold uppercase tracking-widest border-b border-black pb-1 hover:text-ruby hover:border-ruby transition-colors"
            >
              View All Products
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
