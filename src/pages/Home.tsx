import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShoppingBag, ArrowRight, Star, ShieldCheck, Truck, RotateCcw } from 'lucide-react';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Product } from '../types';

export default function Home() {
  const [featuredProducts, setFeaturedProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchProducts = async () => {
      try {
        const q = query(collection(db, 'products'), limit(4));
        const querySnapshot = await getDocs(q);
        const productsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setFeaturedProducts(productsData);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative h-[90vh] flex items-center overflow-hidden bg-black">
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=80&w=2000" 
            alt="Hero" 
            className="w-full h-full object-cover opacity-60"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            <span className="inline-block px-4 py-1.5 bg-ruby text-white text-[10px] font-bold uppercase tracking-[0.3em] mb-6 rounded-full">
              New Collection 2026
            </span>
            <h1 className="text-6xl md:text-8xl font-serif font-bold text-white leading-tight mb-8 tracking-tighter">
              The <span className="text-ruby italic">Ruby</span> Fashion.
            </h1>
            <p className="text-xl text-gray-300 mb-10 font-light leading-relaxed max-w-lg">
              Experience the pinnacle of luxury fashion. Curated styles for those who dare to stand out.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                to="/shop" 
                className="inline-flex items-center justify-center px-10 py-5 bg-ruby text-white text-xs font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all duration-500 group rounded-full"
              >
                Shop Collection
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={16} />
              </Link>
              <Link 
                to="/about" 
                className="inline-flex items-center justify-center px-10 py-5 border border-white/30 text-white text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all duration-500 rounded-full"
              >
                Our Story
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white border-b border-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { icon: Truck, title: "Free Shipping", desc: "On orders over ₹999" },
              { icon: ShieldCheck, title: "Secure Payment", desc: "100% protected" },
              { icon: RotateCcw, title: "Easy Returns", desc: "30-day guarantee" },
              { icon: Star, title: "Premium Quality", desc: "Crafted with care" }
            ].map((feature, i) => (
              <div key={i} className="text-center space-y-3 group">
                <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto text-gray-400 group-hover:bg-ruby group-hover:text-white transition-all duration-500">
                  <feature.icon size={24} />
                </div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">{feature.title}</h3>
                <p className="text-xs text-gray-400 font-medium">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-24 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <div className="space-y-4">
              <span className="text-ruby text-[10px] font-bold uppercase tracking-[0.3em]">Trending Now</span>
              <h2 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 tracking-tight">Featured Arrivals</h2>
            </div>
            <Link to="/shop" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-ruby transition-colors flex items-center gap-2 group">
              View All Products
              <div className="w-8 h-px bg-gray-200 group-hover:bg-ruby group-hover:w-12 transition-all"></div>
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="animate-pulse space-y-4">
                  <div className="aspect-[3/4] bg-gray-200 rounded-3xl"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {featuredProducts.map((product) => (
                <motion.div 
                  key={product.id}
                  whileHover={{ y: -10 }}
                  className="group"
                >
                  <Link to={`/product/${product.id}`} className="block space-y-6">
                    <div className="relative aspect-[3/4] overflow-hidden rounded-3xl bg-gray-100">
                      <img 
                        src={product.images[0]} 
                        alt={product.name} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        referrerPolicy="no-referrer"
                      />
                      {product.comparePrice > product.price && (
                        <div className="absolute top-4 left-4 bg-white px-3 py-1 rounded-full text-[10px] font-bold text-ruby uppercase tracking-widest shadow-sm">
                          Sale
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="bg-white text-black px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest transform translate-y-4 group-hover:translate-y-0 transition-transform">
                          Quick View
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 text-center">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{product.category}</p>
                      <h3 className="text-sm font-bold text-gray-900 group-hover:text-ruby transition-colors">{product.name}</h3>
                      <div className="flex items-center justify-center space-x-3">
                        <span className="text-sm font-black text-gray-900">₹{product.price}</span>
                        {product.comparePrice > product.price && (
                          <span className="text-xs text-gray-400 line-through">₹{product.comparePrice}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-[3rem] overflow-hidden bg-ruby py-20 px-8 md:px-20 text-center">
            <div className="absolute inset-0 opacity-10">
              <img src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=2000" alt="Pattern" className="w-full h-full object-cover" />
            </div>
            <div className="relative max-w-2xl mx-auto space-y-8">
              <h2 className="text-4xl md:text-6xl font-serif font-bold text-white leading-tight">Join The Ruby Circle</h2>
              <p className="text-ruby-100 font-medium">Get early access to new drops and exclusive offers. Be the first to know what's trending.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <input 
                  type="email" 
                  placeholder="Enter your email" 
                  className="px-8 py-5 rounded-full bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:bg-white/20 transition-all min-w-[300px]"
                />
                <button className="px-10 py-5 bg-white text-ruby rounded-full text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all duration-500">
                  Subscribe
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
