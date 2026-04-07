import React from 'react';
import { Link } from 'react-router-dom';
import { useWishlist } from '../contexts/WishlistContext';
import ProductCard from '../components/ProductCard';
import { Heart, ChevronLeft } from 'lucide-react';

export default function Wishlist() {
  const { items } = useWishlist();

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center space-y-8">
        <div className="w-24 h-24 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-8">
          <Heart size={48} />
        </div>
        <h1 className="text-4xl font-serif font-bold">Your wishlist is empty</h1>
        <p className="text-gray-500 font-light tracking-wide max-w-sm mx-auto">
          Save your favorite items to your wishlist and they'll appear here.
        </p>
        <Link to="/shop" className="inline-block bg-ruby text-white px-12 py-5 text-sm font-bold uppercase tracking-widest hover:bg-ruby-dark transition-all">
          Explore Collection
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-12">
        <h1 className="text-4xl font-serif font-bold">My Wishlist</h1>
        <Link to="/shop" className="flex items-center text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-colors">
          <ChevronLeft size={16} className="mr-2" />
          Continue Shopping
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-16">
        {items.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
