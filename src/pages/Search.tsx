import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Product } from '../types';
import { Search as SearchIcon, X, ArrowRight, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';

export default function Search() {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'products'));
        const productsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[];
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
      const filtered = products.filter(product => 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  }, [searchTerm, products]);

  return (
    <div className="min-h-screen bg-white pt-24 pb-20 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="space-y-4">
          <h1 className="text-3xl font-serif font-bold text-[#1A2C54]">Search <span className="text-ruby italic">The Ruby</span></h1>
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
            <div className="grid grid-cols-1 gap-4">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">{filteredProducts.length} Results found</h2>
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
                        <img 
                          src={product.images[0]} 
                          alt={product.name} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-grow min-w-0">
                        <h3 className="text-sm font-bold text-[#1A2C54] truncate">{product.name}</h3>
                        <p className="text-xs text-gray-400 font-medium">{product.category}</p>
                        <p className="text-sm font-bold text-ruby mt-1">₹{product.price.toLocaleString()}</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-ruby group-hover:text-white transition-all">
                        <ArrowRight size={18} />
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
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
