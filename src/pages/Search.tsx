import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Product } from '../types';
import { Search as SearchIcon, X, ArrowRight, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { formatPrice } from '../utils/currency';
import { checkProductHealth, logProductDiagnostics } from '../utils/productHealthCheck';

export default function Search() {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data: catData } = await supabase
          .from('categories')
          .select('*');

        const categoryMap: Record<string, string> = {};
        if (catData) {
          catData.forEach(c => {
            categoryMap[c.id] = c.name;
          });
        }

        const { data: prodData, error: prodErr } = await supabase
          .from('products')
          .select('*')
          .order('created_at', { ascending: false });

        if (prodErr) {
          console.warn("Search products fetch error:", prodErr);
        }

        const productsData: Product[] = (prodData || []).map(p => ({
          id: p.id,
          name: p.name || '',
          description: p.description || '',
          price: Number(p.price || 0),
          comparePrice: p.compare_price ? Number(p.compare_price) : undefined,
          category: (p.category_ids || []).map((id: string) => categoryMap[id]).filter(Boolean),
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
        }));

        console.log(`[Product Diagnostic - Query Result Count] Search fetched ${productsData.length} products total.`);

        productsData.forEach(p => {
          const health = checkProductHealth(p);
          if (!health.isValid) {
            console.warn(`[Product Diagnostic - Health Check Warning] Search product "${p.name}" (${p.id}) has health issues:`, health.errors, health.warnings);
          }
          logProductDiagnostics('Rendered', p);
        });

        setProducts(productsData);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredProducts([]);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = products.filter(product => {
        const nameMatch = (product.name || '').toLowerCase().includes(term);
        
        let catMatch = false;
        if (product.category) {
          if (Array.isArray(product.category)) {
            catMatch = product.category.some(c => String(c || '').toLowerCase().includes(term));
          } else if (typeof product.category === 'string') {
            catMatch = product.category.toLowerCase().includes(term);
          }
        }

        const descMatch = (product.description || '').toLowerCase().includes(term);

        const isMatch = nameMatch || catMatch || descMatch;
        if (!isMatch) {
          logProductDiagnostics('Hidden', product, `Search term "${searchTerm}" did not match name, category, or description.`);
        }
        return isMatch;
      });
      setFilteredProducts(filtered);
    }
  }, [searchTerm, products]);

  return (
    <div className="min-h-screen bg-white pt-2 pb-20 px-4">
      <div className="max-w-7xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8">
        <div className="space-y-3">
          <h1 className="text-2xl font-serif font-bold text-[#1A2C54]">Search <span className="text-ruby italic">The Ruby Fashion</span></h1>
          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-ruby transition-colors">
              <SearchIcon size={20} />
            </div>
            <input 
              type="text" 
              placeholder="Search for products, categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
              className="w-full bg-gray-50 border border-transparent px-14 py-5 rounded-3xl text-sm focus:outline-none focus:bg-white focus:border-ruby/20 focus:ring-4 focus:ring-ruby/5 transition-all placeholder:text-gray-300 font-medium"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-ruby transition-colors"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-ruby/20 border-t-ruby rounded-full animate-spin" />
            </div>
          ) : searchTerm.trim() === '' ? (
            <div className="space-y-6">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Popular Categories</h2>
              <div className="flex flex-wrap gap-3">
                {['New Arrivals', 'Women', 'Men', 'Accessories'].map((cat) => (
                  <button 
                    key={cat}
                    onClick={() => setSearchTerm(cat)}
                    className="px-6 py-3 bg-gray-50 hover:bg-ruby/5 hover:text-ruby border border-transparent hover:border-ruby/20 rounded-full text-xs font-bold uppercase tracking-widest transition-all"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="space-y-4">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">{filteredProducts.length} Results found</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                {filteredProducts.map((product) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    layout
                  >
                    <Link 
                      to={`/product/${product.id}`}
                      className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl hover:border-ruby/20 hover:shadow-lg hover:shadow-ruby/5 transition-all group"
                    >
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-50 flex-shrink-0">
                        {product.images[0] && (
                          <img 
                            src={product.images[0]} 
                            alt={product.name} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                        )}
                      </div>
                      <div className="flex-grow min-w-0">
                        <h3 className="text-sm font-bold text-[#1A2C54] truncate">{product.name}</h3>
                        <p className="text-xs text-gray-400 font-medium">
                          {Array.isArray(product.category) ? product.category.join(', ') : product.category}
                        </p>
                        <p className="text-sm font-bold text-ruby mt-1">{formatPrice(Number(product.price || 0))}</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-ruby group-hover:text-white transition-all">
                        <ArrowRight size={18} />
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 space-y-4">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
                <SearchIcon size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-serif font-bold text-[#1A2C54]">No results found</h3>
                <p className="text-sm text-gray-400">We couldn't find anything matching "{searchTerm}"</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
