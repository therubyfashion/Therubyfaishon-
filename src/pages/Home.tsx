import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Star, ShieldCheck, Truck } from 'lucide-react';

export default function Home() {
  return (
    <div className="space-y-24 pb-24">
      {/* Hero Section */}
      <section className="relative h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=80&w=2000" 
            alt="Hero Fashion" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-black/40" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-white">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl space-y-8"
          >
            <h1 className="text-6xl md:text-8xl font-serif font-bold leading-tight">
              The <span className="text-ruby italic">Ruby</span> <br />
              Fashion Store
            </h1>
            <p className="text-xl text-gray-200 font-light tracking-wide max-w-lg">
              Welcome to The Ruby. Discover our new collection where timeless fashion meets modern sophistication. Crafted for those who lead with style.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link to="/shop" className="bg-ruby hover:bg-ruby-dark text-white px-10 py-4 text-sm font-bold uppercase tracking-widest transition-all flex items-center justify-center group">
                Shop Collection
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={18} />
              </Link>
              <Link to="/shop?category=New Arrivals" className="bg-white/10 backdrop-blur-md hover:bg-white/20 text-white border border-white/30 px-10 py-4 text-sm font-bold uppercase tracking-widest transition-all flex items-center justify-center">
                New Arrivals
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Featured Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { name: "Women's", category: "Women", img: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=800" },
            { name: "Men's", category: "Men", img: "https://images.unsplash.com/photo-1488161628813-244768e242c4?auto=format&fit=crop&q=80&w=800" },
            { name: "Accessories", category: "New Arrivals", img: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800" }
          ].map((cat, idx) => (
            <Link 
              key={idx} 
              to={`/shop?category=${cat.category}`}
              className="group relative h-[500px] overflow-hidden block"
            >
              <img 
                src={cat.img} 
                alt={cat.name} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
              <div className="absolute bottom-10 left-10 text-white">
                <h3 className="text-3xl font-serif font-bold mb-2">{cat.name}</h3>
                <span className="text-xs font-bold uppercase tracking-widest border-b border-white pb-1 group-hover:text-ruby group-hover:border-ruby transition-colors">Explore</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Brand Values */}
      <section className="bg-gray-50 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 text-center">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-ruby/10 text-ruby rounded-full flex items-center justify-center mx-auto mb-6">
                <ShieldCheck size={32} />
              </div>
              <h4 className="text-lg font-bold uppercase tracking-widest">Premium Quality</h4>
              <p className="text-gray-500 text-sm leading-relaxed">Every piece is crafted with the finest materials and meticulous attention to detail.</p>
            </div>
            <div className="space-y-4">
              <div className="w-16 h-16 bg-ruby/10 text-ruby rounded-full flex items-center justify-center mx-auto mb-6">
                <Truck size={32} />
              </div>
              <h4 className="text-lg font-bold uppercase tracking-widest">Fast Shipping</h4>
              <p className="text-gray-500 text-sm leading-relaxed">Enjoy reliable and fast delivery to your doorstep, worldwide.</p>
            </div>
            <div className="space-y-4">
              <div className="w-16 h-16 bg-ruby/10 text-ruby rounded-full flex items-center justify-center mx-auto mb-6">
                <Star size={32} />
              </div>
              <h4 className="text-lg font-bold uppercase tracking-widest">Exclusive Designs</h4>
              <p className="text-gray-500 text-sm leading-relaxed">Unique styles you won't find anywhere else, inspired by the ruby's brilliance.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="ruby-gradient p-12 md:p-20 text-center text-white space-y-8">
          <h2 className="text-4xl md:text-5xl font-serif font-bold">Join the Ruby Circle</h2>
          <p className="text-ruby-light/30 max-w-xl mx-auto text-white/80 font-light tracking-wide">
            Subscribe to receive updates on new arrivals, exclusive offers, and styling tips.
          </p>
          <form className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto pt-4">
            <input 
              type="email" 
              placeholder="Your email address" 
              className="flex-grow bg-white/10 border border-white/30 px-6 py-4 text-sm focus:outline-none focus:bg-white/20 transition-all"
            />
            <button className="bg-white text-ruby px-8 py-4 text-sm font-bold uppercase tracking-widest hover:bg-gray-100 transition-all">
              Subscribe
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
