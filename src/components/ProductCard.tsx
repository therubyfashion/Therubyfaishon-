import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Heart, Star } from 'lucide-react';
import { Product } from '../types';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';
import { useAuth } from '../contexts/AuthContext';
import { trackPixelEvent } from '../lib/pixel';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { formatPrice } from '../utils/currency';
import { supabase } from '../supabase';

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { user } = useAuth();
  const [reviewStats, setReviewStats] = useState({ average: 0, count: 0 });

  useEffect(() => {
    let active = true;
    if (!product || !product.id) return;
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase
          .from('reviews')
          .select('rating')
          .eq('product_id', product.id);

        if (error) throw error;
        if (!active) return;

        const ratings = (data || []).map(row => Number(row.rating || 0));
        const count = ratings.length;
        const average = count > 0 ? ratings.reduce((sum, r) => sum + r, 0) / count : 0;
        setReviewStats({ average, count });
      } catch (err) {
        console.warn("Failed to fetch product review stats:", err);
      }
    };
    fetchStats();
    return () => { active = false; };
  }, [product?.id]);

  if (!product || !product.id) {
    return null;
  }

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Do not navigate if a button or something inside a button is clicked
    if (target.closest('button')) {
      return;
    }
    navigate(`/product/${product.id}`);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    addToCart(product, (product.sizes && product.sizes[0]) || 'M');
    
    // Meta Pixel Tracking
    trackPixelEvent('AddToCart', {
      content_name: product.name,
      content_category: product.category,
      content_ids: [product.id],
      content_type: 'product',
      value: product.price,
      currency: 'INR'
    });

    toast.success(`${product.name} added to cart`);
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      toast.error("Please login to add items to your wishlist");
      return;
    }
    
    const isCurrentlyInWishlist = isInWishlist(product.id);
    toggleWishlist(product);
    
    if (isCurrentlyInWishlist) {
      toast.info(`Removed ${product.name} from wishlist`);
    } else {
      toast.success(`Added ${product.name} to wishlist`);
    }
  };

  return (
    <div 
      onClick={handleCardClick}
      className="product-card group block bg-white rounded-2xl overflow-hidden border border-gray-100 cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl"
    >
      <div className="product-img relative aspect-[3/4] bg-gray-50 flex items-center justify-center overflow-hidden">
        {(product.images && product.images[0]) ? (
          <img 
            src={product.images[0]} 
            alt={product.name} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-200 text-6xl">
            <ShoppingBag size={64} />
          </div>
        )}

        {/* Discount Badge */}
        {product.comparePrice && product.comparePrice > product.price && (
          <div className="product-discount absolute top-3 left-3 bg-ruby text-white rounded-md px-2.5 py-1 text-[11px] font-bold z-10">
            -{Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)}%
          </div>
        )}

        {/* Wishlist Button */}
        <button 
          onClick={handleWishlist}
          className={cn(
            "product-wish absolute top-3 right-3 w-8.5 h-8.5 bg-white rounded-full flex items-center justify-center shadow-md transition-transform duration-200 hover:scale-115 z-10",
            isInWishlist(product.id) ? "text-ruby" : "text-gray-400 hover:text-ruby"
          )}
        >
          <Heart size={16} fill={isInWishlist(product.id) ? "currentColor" : "none"} />
        </button>

        {/* Quick Add Overlay */}
        <div className="absolute inset-x-0 bottom-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          <button 
            onClick={handleAddToCart}
            className="w-full bg-[#1A2C54] text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-ruby transition-all shadow-lg"
          >
            Quick Add
          </button>
        </div>
      </div>
      
      <div className="product-info p-4">
        <p className="product-brand text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-1 truncate">
          {Array.isArray(product.category) ? product.category.join(', ') : product.category}
        </p>
        <h3 className="product-name text-sm font-medium text-[#1A2C54] mb-1.5 line-clamp-1 group-hover:text-ruby transition-colors">{product.name}</h3>
        
        <div className="product-price-row flex items-center gap-2">
          <span className="product-price text-base font-bold text-ruby">{formatPrice(Number(product.price || 0))}</span>
          {product.comparePrice && product.comparePrice > product.price && (
            <span className="product-original text-xs text-gray-400 line-through">{formatPrice(Number(product.comparePrice || 0))}</span>
          )}
        </div>
        
        {/* Real-time review count matching product details page logic */}
        {reviewStats.count > 0 ? (
          <div className="product-rating flex items-center gap-1 mt-1 text-[12px] text-gray-400">
            <div className="flex text-yellow-400">
              <Star size={10} fill="currentColor" />
            </div>
            <span className="font-semibold text-gray-700">{reviewStats.average.toFixed(1)}</span>
            <span className="text-[10px] text-gray-400 leading-none">({reviewStats.count})</span>
          </div>
        ) : (
          <div className="product-rating flex items-center gap-1 mt-1 text-[11px] text-gray-400 font-medium">
            No reviews yet
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
