import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Product, Category } from '../types';
import ProductCard from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/Skeleton';
import { Filter, ChevronDown, SlidersHorizontal, Truck, RefreshCw, ShieldCheck } from 'lucide-react';

const fallbackProducts: Product[] = [
  {
    id: "fp1",
    name: "Royal Crimson Anarkali Kurta Set",
    price: 1899,
    comparePrice: 2999,
    category: ["Kurti"],
    sizes: ["M", "L", "XL", "XXL"],
    images: ["https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?auto=format&fit=crop&q=80&w=800"],
    stock: 25,
    stockStatus: "In Stock",
    isTrending: true,
    description: "Grace any occasion with this beautiful heavy georgette crimson red Anarkali kurta set. Richly embroidered with golden zari work.",
    createdAt: new Date().toISOString()
  },
  {
    id: "fp2",
    name: "Elegant Banarasi Red Silk Saree",
    price: 3499,
    comparePrice: 5999,
    category: ["Sarees"],
    sizes: ["M", "L"],
    images: ["https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800"],
    stock: 15,
    stockStatus: "In Stock",
    isTrending: true,
    description: "Impeccably handwoven silk saree featuring exquisite golden Banarasi borders.",
    createdAt: new Date().toISOString()
  },
  {
    id: "fp3",
    name: "Sapphire Blue Velvet Lehenga Choli",
    price: 4999,
    comparePrice: 8999,
    category: ["Lehengas"],
    sizes: ["S", "M", "L"],
    images: ["https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=800"],
    stock: 10,
    stockStatus: "In Stock",
    isTrending: true,
    description: "Stunning sapphire blue velvet lehenga, heavily embellished with sequins and pearl work.",
    createdAt: new Date().toISOString()
  },
  {
    id: "fp4",
    name: "Classic Ivory Lucknowi Chikankari Kurti",
    price: 1299,
    comparePrice: 2299,
    category: ["Kurti"],
    sizes: ["S", "M", "L", "XL"],
    images: ["https://images.unsplash.com/photo-1608933221953-c6cd6a7f0525?auto=format&fit=crop&q=80&w=800"],
    stock: 45,
    stockStatus: "In Stock",
    isTrending: false,
    description: "Traditional Lucknowi hand-embroidered georgette Chikankari kurti in ivory white.",
    createdAt: new Date().toISOString()
  }
];

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
        if (parsed.products) setProducts(parsed.products);
        if (parsed.categories) setCategories(parsed.categories);
        setLoading(false);
      }
    } catch (e) {
      console.warn("Failed to load shop cache:", e);
    }
  }, [activeCategory, sortBy]);

  useEffect(() => {
    const fetchProducts = async () => {
      const cacheKey = `ruby_shop_cache_${activeCategory}_${sortBy}`;
      const hasCache = localStorage.getItem(cacheKey) !== null;
      if (!hasCache) {
        setLoading(true);
      }
      try {
        const productsQuery = activeCategory !== 'All' 
          ? query(collection(db, 'products'), where('category', 'array-contains', activeCategory), limit(24))
          : query(collection(db, 'products'), limit(24));

        const [productsSnap, categoriesSnap] = await Promise.all([
          getDocs(productsQuery).catch((err) => { console.warn("Failed fetching shop products:", err); return { docs: [] } as any; }),
          getDocs(collection(db, 'categories')).catch((err) => { console.warn("Failed fetching shop categories:", err); return { docs: [] } as any; })
        ]);

        // Handle categories sorted by sortOrder
        const sortedCategoryDocs = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        sortedCategoryDocs.sort((a, b) => {
          const orderA = a.sortOrder !== undefined ? Number(a.sortOrder) : 1000;
          const orderB = b.sortOrder !== undefined ? Number(b.sortOrder) : 1000;
          return orderA - orderB;
        });
        const catNames = sortedCategoryDocs.map(c => c.name);
        const finalCategories = ['All', ...catNames];
        setCategories(finalCategories);

        let fetchedProducts = productsSnap.docs.map(doc => ({
          id: doc.id,
          ...(doc.data() as Omit<Product, 'id'>)
        })) as Product[];
        
        if (fetchedProducts.length === 0) {
          fetchedProducts = activeCategory === 'All' 
            ? fallbackProducts 
            : fallbackProducts.filter(p => p.category?.includes(activeCategory));
        }
        
        // Client-side sorting
        fetchedProducts.sort((a, b) => {
          if (sortBy === 'newest') {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
          if (sortBy === 'price-low') {
            return a.price - b.price;
          }
          if (sortBy === 'price-high') {
            return b.price - a.price;
          }
          return 0;
        });

        setProducts(fetchedProducts);

        // Save to cache
        try {
          const cacheData = {
            products: fetchedProducts,
            categories: finalCategories,
            savedAt: Date.now()
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (e) {
          console.warn("Failed to write shop cache:", e);
        }
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
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
