import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Product } from '../types';

import ProductCard from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/Skeleton';
import { Filter, ChevronDown, SlidersHorizontal, Truck, RefreshCw, ShieldCheck } from 'lucide-react';
import { checkProductHealth, logProductDiagnostics } from '../utils/productHealthCheck';

const mapSupabaseProduct = (p: any, categoryMap: Record<string, string>): Product => {
  const mappedCategory = (p.category_ids || [])
    .map((id: string) => categoryMap[id])
    .filter(Boolean);

  return {
    id: p.id,
    name: p.name || '',
    description: p.description || '',
    price: Number(p.price || 0),
    comparePrice: p.compare_price ? Number(p.compare_price) : undefined,
    category: mappedCategory,
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
    wishlistCount: p.wishlist_count ?? 0,
  };
};

export default function Shop() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [activeCategory, setActiveCategory] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('category') || 'All';
    } catch (e) {
      return 'All';
    }
  });
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
        const hasDummy = (parsed.products && parsed.products.some((p: any) => !p.id || p.id.startsWith('fp') || p.id.startsWith('fb_'))) ||
                         (parsed.categories && parsed.categories.some((c: any) => c !== 'All' && c.startsWith('fb_')));
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

  // Main data fetch and subscription
  useEffect(() => {
    const cacheKey = `ruby_shop_cache_${activeCategory}_${sortBy}`;
    const hasCache = localStorage.getItem(cacheKey) !== null;
    if (!hasCache && products.length === 0) {
      setLoading(true);
    }

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

    const fetchAllData = async () => {
      try {
        // 1. Fetch categories
        const { data: catData, error: catErr } = await supabase
          .from('categories')
          .select('*')
          .order('sort_order', { ascending: true });

        if (catErr) {
          console.warn("Shop categories error:", catErr);
        }

        const categoryMap: Record<string, string> = {};
        const catNames: string[] = [];
        (catData || []).forEach(c => {
          if (c.id && c.name) {
            categoryMap[c.id] = c.name;
            catNames.push(c.name);
          }
        });

        const finalCategories = ['All', ...catNames];
        setCategories(finalCategories);
        saveToCache('categories', finalCategories);

        // 2. Fetch products
        const { data: prodData, error: prodErr } = await supabase
          .from('products')
          .select('*')
          .order('created_at', { ascending: false });

        if (prodErr) {
          console.warn("Shop products error:", prodErr);
        }

        const rawProds = (prodData || []).map(p => mapSupabaseProduct(p, categoryMap));
        console.log(`[Product Diagnostic - Query Result Count] Total products fetched from Supabase: ${rawProds.length}`);

        setAllProducts(rawProds);
      } catch (err) {
        console.warn("Error inside Supabase data fetch:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();

    // Set up real-time postgres changes channel
    const channel = supabase
      .channel('shop-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories' },
        () => {
          fetchAllData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          fetchAllData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Client-side filtering and sorting
  useEffect(() => {
    const cacheKey = `ruby_shop_cache_${activeCategory}_${sortBy}`;
    
    let prods = [...allProducts];

    // Filter by activeCategory
    if (activeCategory !== 'All') {
      prods = prods.filter(p => {
        const matches = Array.isArray(p.category)
          ? p.category.includes(activeCategory)
          : p.category === activeCategory;
        
        if (!matches) {
          logProductDiagnostics('Hidden', p, `Category mismatch. Product category: ${JSON.stringify(p.category)}, active category: "${activeCategory}"`);
        }
        return matches;
      });
    }

    // Run health checks & diagnostics
    prods.forEach(p => {
      const health = checkProductHealth(p);
      if (!health.isValid) {
        console.warn(`[Product Diagnostic - Health Check Warning] Product "${p.name}" (${p.id}) has health issues:`, health.errors, health.warnings);
      }
      logProductDiagnostics('Rendered', p);
    });

    // Sort products
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

    setProducts(prods);

    // Save to cache
    try {
      const cached = localStorage.getItem(cacheKey);
      const parsed = cached ? JSON.parse(cached) : {};
      parsed.products = prods;
      parsed.categories = categories;
      parsed.savedAt = Date.now();
      localStorage.setItem(cacheKey, JSON.stringify(parsed));
    } catch (e) {}

  }, [allProducts, activeCategory, sortBy, categories]);

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    try {
      const params = new URLSearchParams(window.location.search);
      if (cat === 'All') {
        params.delete('category');
      } else {
        params.set('category', cat);
      }
      const newQuery = params.toString();
      const newUrl = window.location.pathname + (newQuery ? '?' + newQuery : '');
      window.history.pushState(null, '', newUrl);
    } catch (e) {
      console.warn("Failed to update URL search params natively:", e);
    }
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
