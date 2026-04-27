import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { doc, getDoc, collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp, updateDoc, increment, getDocs, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Product, Review } from '../types';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';
import { toast } from 'sonner';
import { ShoppingBag, Heart, Share2, ChevronRight, Truck, ShieldCheck, RefreshCw, X, Ruler, Star, MessageSquare, ThumbsUp, User, Minus, Plus, Send, ChevronDown, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Zoom, Thumbs } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import { ProductDetailSkeleton } from '../components/Skeleton';
import ProductCard from '../components/ProductCard';

function ReviewForm({ productId, onReviewAdded }: { productId: string; onReviewAdded: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      toast.error("Please login to write a review");
      return;
    }
    if (!comment.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        productId,
        userName: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Anonymous',
        userEmail: auth.currentUser.email,
        userImage: auth.currentUser.photoURL || '',
        rating,
        comment,
        createdAt: new Date().toISOString(),
        likes: 0
      });
      toast.success("Review submitted successfully!");
      setComment('');
      setRating(5);
      onReviewAdded();
    } catch (error) {
      console.error("Error adding review:", error);
      toast.error("Failed to submit review");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-[2.5rem] p-8 space-y-6">
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-[#1A2C54]">Write a Review</h3>
        <div className="flex items-center space-x-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="transition-transform hover:scale-110"
            >
              <Star
                size={24}
                fill={(hoverRating || rating) >= star ? "currentColor" : "none"}
                className={(hoverRating || rating) >= star ? "text-yellow-400" : "text-gray-200"}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Your Review</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your experience with this product..."
          className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ruby/10 h-32 resize-none"
        />
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-[#1A2C54] text-white py-4 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-ruby transition-all active:scale-95 flex items-center justify-center disabled:opacity-50"
      >
        {isSubmitting ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <Send size={16} className="mr-2" />
            Submit Review
          </>
        )}
      </button>
    </form>
  );
}

function SizeChartModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 40 }}
            className="relative bg-white w-full max-w-lg p-6 lg:p-8 rounded-[2rem] shadow-2xl space-y-6 overflow-hidden"
          >
            <div className="flex justify-between items-center border-b border-gray-50 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-ruby/10 rounded-xl flex items-center justify-center text-ruby">
                  <Ruler size={20} />
                </div>
                <h3 className="text-xl font-bold text-[#1A2C54]">Size Chart</h3>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-gray-50/50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  <tr>
                    <th className="px-4 py-4 rounded-tl-xl">Size</th>
                    <th className="px-4 py-4">Chest (in)</th>
                    <th className="px-4 py-4">Waist (in)</th>
                    <th className="px-4 py-4 rounded-tr-xl">Length (in)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { s: 'S', c: '36-38', w: '30-32', l: '27' },
                    { s: 'M', c: '38-40', w: '32-34', l: '28' },
                    { s: 'L', c: '40-42', w: '34-36', l: '29' },
                    { s: 'XL', c: '42-44', w: '36-38', l: '30' },
                    { s: 'XXL', c: '44-46', w: '38-40', l: '31' },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/30 transition-colors group">
                      <td className="px-4 py-4 font-bold text-[#1A2C54] group-hover:text-ruby transition-colors">{row.s}</td>
                      <td className="px-4 py-4 text-gray-500">{row.c}</td>
                      <td className="px-4 py-4 text-gray-500">{row.w}</td>
                      <td className="px-4 py-4 text-gray-500">{row.l}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-[10px] text-gray-400 text-center leading-relaxed">
                <span className="font-bold text-ruby uppercase tracking-widest block mb-1">Pro Tip</span>
                If you are between sizes, we recommend going for the larger size for a more comfortable fit.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function FullScreenViewer({ 
  isOpen, 
  onClose, 
  images, 
  initialIndex 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  images: string[]; 
  initialIndex: number 
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-black flex flex-col"
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 relative z-10">
          <span className="text-white/60 text-xs font-bold uppercase tracking-widest">
             Full View
          </span>
          <button 
            onClick={onClose}
            className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Swiper */}
        <div className="flex-grow flex items-center justify-center">
          <Swiper
            modules={[Navigation, Pagination, Zoom]}
            navigation
            pagination={{ clickable: true, dynamicBullets: true }}
            zoom={true}
            initialSlide={initialIndex}
            className="w-full h-full"
          >
            {images.map((img, idx) => (
              <SwiperSlide key={idx} className="flex items-center justify-center">
                <div className="swiper-zoom-container h-full w-full flex items-center justify-center">
                  <img src={img} alt="" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [activeImage, setActiveImage] = useState(0);
  const [isSizeChartOpen, setIsSizeChartOpen] = useState(false);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [thumbsSwiper, setThumbsSwiper] = useState<SwiperType | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'highest' | 'lowest'>('newest');

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as Product;
          setProduct(data);
          if (data.sizes && data.sizes.length > 0) setSelectedSize(data.sizes[0]);
          if (data.variants && data.variants.length > 0) setSelectedColor(data.variants[0].color);
          
          // Fetch Related Products
          const relatedQuery = query(
            collection(db, 'products'),
            where('category', '==', data.category),
            limit(5)
          );
          const relatedSnap = await getDocs(relatedQuery);
          const related = relatedSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Product))
            .filter(p => p.id !== id)
            .slice(0, 4);
          setRelatedProducts(related);
        } else {
          toast.error("Product not found");
          navigate('/shop');
        }
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        setLoading(false);
      }
    };
    const fetchReviews = async () => {
      if (!id) return;
      try {
        const q = query(
          collection(db, 'reviews'),
          where('productId', '==', id)
        );
        const snapshot = await getDocs(q);
        const fetchedReviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
        // Sort client-side to avoid needing a composite index
        fetchedReviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setReviews(fetchedReviews);
      } catch (error) {
        console.error("Error fetching reviews:", error);
      }
    };

    fetchProduct();
    fetchReviews();
  }, [id, navigate]);

  if (loading) return <ProductDetailSkeleton />;
  if (!product) return null;

  const handleAddToCart = () => {
    addToCart(product, selectedSize, selectedColor, quantity);
    toast.success(`${product.name} added to cart`, {
      description: `Quantity: ${quantity}, Size: ${selectedSize}, Color: ${selectedColor}`,
      icon: <ShoppingBag className="text-ruby" size={16} />
    });
  };

  const handleLikeReview = async (reviewId: string) => {
    if (!auth.currentUser) {
      toast.error("Please login to like a review");
      return;
    }
    try {
      const reviewRef = doc(db, 'reviews', reviewId);
      await updateDoc(reviewRef, {
        likes: increment(1)
      });
    } catch (error) {
      console.error("Error liking review:", error);
    }
  };

  const averageRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : "0.0";

  const filteredReviews = starFilter 
    ? reviews.filter(r => r.rating === starFilter)
    : reviews;

  const sortedReviews = [...filteredReviews].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sortBy === 'highest') return b.rating - a.rating;
    if (sortBy === 'lowest') return a.rating - b.rating;
    return 0;
  });

  const handleShare = async () => {
    const shareData = {
      title: product.name,
      text: `Check out this ${product.name} at The Ruby!`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied to clipboard!");
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error("Error sharing:", err);
        toast.error("Failed to share product");
      }
    }
  };

  const colors = Array.from(new Set(product.variants?.map(v => v.color) || []));
  const isFavorite = isInWishlist(product.id);

  return (
    <div id="product-detail" className="bg-gray-50 min-h-screen pb-20">
      <Helmet>
        <title>{`${product.name} | The Ruby Fashion`}</title>
        <meta name="description" content={product.description.replace(/<[^>]*>/g, '').substring(0, 160)} />
        <meta property="og:title" content={`${product.name} | The Ruby`} />
        <meta property="og:description" content={product.description.replace(/<[^>]*>/g, '').substring(0, 160)} />
        <meta property="og:image" content={product.images[0]} />
        <meta property="og:url" content={`https://therubyfashion.shop/product/${product.id}`} />
        <link rel="canonical" href={`https://therubyfashion.shop/product/${product.id}`} />
      </Helmet>
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-[5%] py-5 flex items-center gap-2 text-[13px] text-gray-400 font-medium">
        <button onClick={() => navigate('/')} className="hover:text-ruby transition-colors">Home</button>
        <span>/</span>
        <button onClick={() => navigate('/shop')} className="hover:text-ruby transition-colors">Shop</button>
        <span>/</span>
        <span className="text-ruby">{product.name}</span>
      </div>

      <div className="max-w-7xl mx-auto px-[5%] pb-15 grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-[60px]">
        {/* Detail Images */}
        <div className="detail-images space-y-4">
          <div className="relative group">
            <div className="w-full aspect-[3/4] bg-gradient-to-br from-[#fef5f7] to-[#fde8ed] rounded-[24px] overflow-hidden shadow-2xl shadow-ruby/5">
              <Swiper
                modules={[Navigation, Pagination, Thumbs]}
                thumbs={{ swiper: thumbsSwiper && !thumbsSwiper.destroyed ? thumbsSwiper : null }}
                pagination={{ clickable: true, dynamicBullets: true }}
                onSlideChange={(swiper) => setActiveImage(swiper.activeIndex)}
                className="w-full h-full"
              >
                {product.images.map((img, idx) => (
                  <SwiperSlide key={idx} className="relative cursor-zoom-in" onClick={() => setIsFullscreenOpen(true)}>
                    <img 
                      src={img} 
                      alt={product.name} 
                      className="w-full h-full object-cover select-none"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                       <div className="bg-white/90 backdrop-blur-md p-3 rounded-2xl text-ruby shadow-xl border border-white/50">
                          <Maximize2 size={20} />
                       </div>
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>

            {/* Quick Actions Overlay */}
            <div className="absolute top-6 right-6 flex flex-col gap-3 z-10 pointer-events-none">
              <button 
                onClick={(e) => { e.stopPropagation(); toggleWishlist(product); }}
                className={`pointer-events-auto w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl backdrop-blur-md transition-all active:scale-90 ${isFavorite ? 'bg-ruby text-white' : 'bg-white/80 text-gray-400 hover:text-ruby'}`}
              >
                <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleShare(); }}
                className="pointer-events-auto w-12 h-12 bg-white/80 backdrop-blur-md text-gray-400 hover:text-ruby rounded-2xl flex items-center justify-center shadow-xl transition-all active:scale-90"
              >
                <Share2 size={20} />
              </button>
            </div>
          </div>
          
          {product.images.length > 1 && (
            <div className="px-2">
              <Swiper
                onSwiper={setThumbsSwiper}
                spaceBetween={12}
                slidesPerView={4}
                watchSlidesProgress={true}
                modules={[Navigation, Thumbs]}
                className="thumbs-swiper"
              >
                {product.images.map((img, idx) => (
                  <SwiperSlide key={idx}>
                    <div className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all cursor-pointer ${activeImage === idx ? 'border-ruby scale-[1.02] shadow-lg shadow-ruby/10' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                      <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
          )}
        </div>

        {/* Detail Info */}
        <div className="detail-info pt-0">
          <h1 className="font-serif text-[38px] font-bold leading-[1.1] mb-4 text-[#1A2C54] tracking-tight">{product.name}</h1>
          
          <div className="flex items-center gap-[10px] mb-4 text-[14px] text-gray-400">
            <div className="flex text-[#f59e0b] text-[16px]">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={16} fill={i < Math.round(Number(averageRating)) ? "currentColor" : "none"} className={i < Math.round(Number(averageRating)) ? "" : "text-gray-200"} />
              ))}
            </div>
            <span className="font-medium">{averageRating} ({reviews.length} Reviews)</span>
          </div>

          <div className="flex items-center gap-[14px] mb-2">
            <span className="text-[32px] font-bold text-ruby">₹{product.price.toLocaleString()}</span>
            {product.comparePrice && product.comparePrice > product.price && (
              <>
                <span className="text-[18px] text-gray-400 line-through">₹{product.comparePrice.toLocaleString()}</span>
                <span className="px-3 py-1 bg-[#d1fae5] text-[#065f46] rounded-[6px] text-[13px] font-semibold">
                  {Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)}% OFF
                </span>
              </>
            )}
          </div>

          <div className="h-[1px] bg-gray-100 my-6" />

          {/* Size Selection */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-[13px] font-bold text-gray-600 uppercase tracking-wider">Select Size</h4>
              <button 
                onClick={() => setIsSizeChartOpen(true)}
                className="text-[11px] font-bold text-ruby hover:underline uppercase tracking-widest"
              >
                Size Guide
              </button>
            </div>
            <div className="flex gap-[10px] flex-wrap">
              {product.sizes.map(size => (
                <button 
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`w-[50px] h-[50px] rounded-[10px] border-[1.5px] text-[13px] font-bold transition-all ${selectedSize === size ? 'bg-[#1A2C54] text-white border-[#1A2C54]' : 'bg-white text-[#1A2C54] border-gray-100 hover:border-ruby hover:text-ruby'}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          {colors.length > 0 && (
            <div className="mb-7">
              <h4 className="text-[13px] font-bold text-gray-600 uppercase tracking-wider mb-3">Select Color</h4>
              <div className="flex gap-[10px] flex-wrap">
                {colors.map(color => (
                  <button 
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`min-w-[50px] px-4 h-[50px] rounded-[10px] border-[1.5px] text-[13px] font-bold transition-all flex items-center justify-center gap-2 ${selectedColor === color ? 'bg-[#1A2C54] text-white border-[#1A2C54]' : 'bg-white text-[#1A2C54] border-gray-100 hover:border-ruby hover:text-ruby'}`}
                  >
                    <span 
                      className="w-3 h-3 rounded-full border border-gray-200" 
                      style={{ backgroundColor: (color as string).toLowerCase() }}
                    />
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center border-[1.5px] border-gray-100 rounded-[10px] overflow-hidden bg-gray-50">
              <button 
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-11 flex items-center justify-center text-[20px] hover:bg-gray-100 transition-colors"
              >
                <Minus size={16} />
              </button>
              <div className="w-12 h-11 flex items-center justify-center text-[16px] font-bold border-x border-gray-100">
                {quantity}
              </div>
              <button 
                onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                disabled={quantity >= product.stock}
                className="w-10 h-11 flex items-center justify-center text-[20px] hover:bg-gray-100 transition-colors disabled:opacity-30"
              >
                <Plus size={16} />
              </button>
            </div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
              {product.stock > 0 ? `${product.stock} items left` : 'Out of stock'}
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex gap-3 mb-6">
            <button 
              onClick={handleAddToCart}
              disabled={product.stock <= 0}
              className={`flex-grow h-[52px] rounded-[10px] text-[13px] font-bold uppercase tracking-[1.5px] transition-all flex items-center justify-center gap-2 ${
                product.stock > 0 
                ? 'bg-ruby text-white hover:bg-[#1A2C54] shadow-lg shadow-ruby/20' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <ShoppingBag size={18} />
              {product.stock > 0 ? 'Add to Shopping Bag' : 'Out of Stock'}
            </button>
            <button 
              onClick={() => toggleWishlist(product)}
              className={`w-[52px] h-[52px] rounded-[10px] border-[1.5px] flex items-center justify-center transition-all ${isFavorite ? 'bg-ruby/5 border-ruby/20 text-ruby' : 'bg-white border-gray-100 text-gray-400 hover:border-ruby'}`}
            >
              <Heart size={22} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="h-[1px] bg-gray-100 my-6" />

          {/* Product Description */}
          <div className="mb-6">
            <h4 className="text-[13px] font-bold text-gray-600 uppercase tracking-wider mb-3">Product Description</h4>
            <div 
              className="markdown-body text-[14px] leading-relaxed text-gray-500"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          </div>

          <div className="h-[1px] bg-gray-100 my-6" />

          {/* Delivery Info - Kadak Look */}
          <div className="bg-white rounded-[20px] p-6 flex flex-col gap-5 border-2 border-ruby/10 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-ruby/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150 duration-700" />
            
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-ruby text-white rounded-xl flex items-center justify-center shadow-lg shadow-ruby/20">
                <Truck size={22} />
              </div>
              <div>
                <p className="text-[14px] font-black text-[#1A2C54] uppercase tracking-tight">Express Delivery</p>
                <p className="text-[12px] text-gray-400 font-medium">Free on orders above ₹999</p>
              </div>
            </div>

            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-[#1A2C54] text-white rounded-xl flex items-center justify-center shadow-lg shadow-black/20">
                <RefreshCw size={22} />
              </div>
              <div>
                <p className="text-[14px] font-black text-[#1A2C54] uppercase tracking-tight">Easy Returns</p>
                <p className="text-[12px] text-gray-400 font-medium">30 days hassle-free exchange</p>
              </div>
            </div>

            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-ruby/10 text-ruby rounded-xl flex items-center justify-center">
                <ShieldCheck size={22} />
              </div>
              <div>
                <p className="text-[14px] font-black text-[#1A2C54] uppercase tracking-tight">Quality Assured</p>
                <p className="text-[12px] text-gray-400 font-medium">100% Original products only</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="max-w-7xl mx-auto px-[5%] pb-15">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="space-y-2">
            <h2 className="text-[28px] font-serif font-bold text-[#1A2C54]">Customer Reviews</h2>
            <div className="flex items-center gap-3">
              <div className="flex text-[#f59e0b]">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={18} fill={i < Math.round(Number(averageRating)) ? "currentColor" : "none"} className={i < Math.round(Number(averageRating)) ? "" : "text-gray-200"} />
                ))}
              </div>
              <span className="text-[15px] font-bold text-[#1A2C54]">{averageRating} out of 5</span>
            </div>
          </div>
          <button 
            onClick={() => setShowReviewForm(!showReviewForm)}
            className="bg-white border-2 border-[#1A2C54] text-[#1A2C54] px-8 py-3 rounded-[10px] text-[12px] font-bold uppercase tracking-widest hover:bg-[#1A2C54] hover:text-white transition-all"
          >
            {showReviewForm ? 'Cancel Review' : 'Write a Review'}
          </button>
        </div>

        {showReviewForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mb-12"
          >
            <ReviewForm productId={product.id} onReviewAdded={() => setShowReviewForm(false)} />
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {sortedReviews.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-200 rounded-[14px] p-12 text-center">
                <MessageSquare size={40} className="mx-auto text-gray-200 mb-4" />
                <p className="text-gray-400 font-medium">No reviews yet. Be the first to share your thoughts!</p>
              </div>
            ) : (
              sortedReviews.map((review) => (
                <div key={review.id} className="bg-white rounded-[14px] p-[20px_24px] border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[14px] font-bold text-[#1A2C54]">{review.userName}</span>
                    <div className="flex text-[#f59e0b]">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={12} fill={i < review.rating ? "currentColor" : "none"} className={i < review.rating ? "" : "text-gray-200"} />
                      ))}
                    </div>
                  </div>
                  <p className="text-[14px] text-gray-600 leading-[1.6] font-light">{review.comment}</p>
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-[12px] text-gray-400 font-medium">
                      {new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <button 
                      onClick={() => handleLikeReview(review.id)}
                      className="flex items-center gap-1.5 text-[12px] font-bold text-gray-400 hover:text-ruby transition-colors group"
                    >
                      <ThumbsUp size={14} className="group-active:scale-125 transition-transform" />
                      <span>{review.likes || 0}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="lg:col-span-1">
            <div className="bg-white rounded-[14px] p-8 border border-gray-100 sticky top-32">
              <h4 className="text-[13px] font-bold uppercase tracking-widest text-gray-400 mb-6">Rating Distribution</h4>
              <div className="space-y-4">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = reviews.filter(r => r.rating === star).length;
                  const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-4">
                      <span className="text-[12px] font-bold text-gray-600 w-3">{star}</span>
                      <div className="flex-grow h-1.5 bg-gray-50 rounded-full overflow-hidden">
                        <div className="h-full bg-ruby" style={{ width: `${percentage}%` }} />
                      </div>
                      <span className="text-[11px] font-bold text-gray-400 w-8">{Math.round(percentage)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className="max-w-7xl mx-auto px-[5%] pb-20">
          <div className="flex items-center justify-between mb-10">
            <div className="space-y-2">
              <h2 className="text-[28px] font-serif font-bold text-[#1A2C54]">You May Also Like</h2>
              <p className="text-gray-400 text-sm font-medium">Handpicked recommendations for you.</p>
            </div>
            <button 
              onClick={() => navigate('/shop')}
              className="text-xs font-bold uppercase tracking-widest text-ruby hover:underline"
            >
              View All
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-16">
            {relatedProducts.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}

      <SizeChartModal isOpen={isSizeChartOpen} onClose={() => setIsSizeChartOpen(false)} />
      <FullScreenViewer 
        isOpen={isFullscreenOpen} 
        onClose={() => setIsFullscreenOpen(false)} 
        images={product.images} 
        initialIndex={activeImage} 
      />
    </div>
  );
}
