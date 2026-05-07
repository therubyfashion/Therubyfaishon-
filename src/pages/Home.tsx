import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, ArrowRight, Star, ShieldCheck, Truck, RotateCcw, 
  Search, Bell, Heart, User, Filter, ChevronRight, Package,
  Shirt, Smartphone, Watch, Laptop, ShoppingCart, Gem, Utensils, ToyBrick,
  Plus, ThumbsUp, ThumbsDown, X
} from 'lucide-react';
import { collection, getDocs, query, where, limit, orderBy, addDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Product, Category } from '../types';
import ProductCard from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/Skeleton';
import { toast } from 'sonner';
import OneSignal from 'onesignal-cordova-plugin';
import { Capacitor } from '@capacitor/core';
import { useNotifications } from '../contexts/NotificationContext';

export default function Home() {
  const [unreadCount] = useState(0); // Notifications context fallback if needed
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [currentReview, setCurrentReview] = useState(0);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [email, setEmail] = useState('');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, text: '', tag: 'Fabric' });
  const [reviews, setReviews] = useState<any[]>([]);
  const navigate = useNavigate();

  const fallbackReviews = [
    {
      id: "f1",
      name: "Priya R.",
      initials: "PR",
      color: "#5a4fcf",
      rating: 5,
      text: "The fabric quality is absolutely amazing. The cotton feels so soft and breathable — wore it all day and stayed comfortable throughout!",
      tag: "Fabric quality",
      date: "May 2, 2024",
      likes: 12,
      dislikes: 0
    },
    {
      id: "f2",
      name: "Arjun M.",
      initials: "AM",
      color: "#d85a30",
      rating: 4,
      text: "Doesn't fade after multiple washes. The stitching is solid and the fabric holds shape well. Great durability for the price!",
      tag: "Durability",
      date: "Apr 28, 2024",
      likes: 8,
      dislikes: 1
    },
    {
      id: "f3",
      name: "Sneha K.",
      initials: "SK",
      color: "#0f6e56",
      rating: 5,
      text: "Loved the premium linen blend. Lightweight yet sturdy — perfect for Indian summers. Will definitely order more from this store!",
      tag: "Summer comfort",
      date: "Apr 25, 2024",
      likes: 15,
      dislikes: 0
    }
  ];

  useEffect(() => {
    // Scroll to top
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const productsQuery = query(
          collection(db, 'products'), 
          where('isTrending', '==', true),
          limit(8)
        );

        const reviewsQuery = query(
          collection(db, 'fabric_reviews'),
          orderBy('createdAt', 'desc'),
          limit(10)
        );

        const [productsSnap, categoriesSnap, bannersSnap, reviewsSnap] = await Promise.all([
          getDocs(productsQuery),
          getDocs(collection(db, 'categories')),
          getDocs(collection(db, 'banners')),
          getDocs(reviewsQuery)
        ]);

        // Handle products with fallback
        let productsData = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        if (productsData.length === 0) {
          const fallbackProductsQuery = query(collection(db, 'products'), limit(8));
          const fallbackProductsSnap = await getDocs(fallbackProductsQuery);
          productsData = fallbackProductsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        }
        setTrendingProducts(productsData);
        setCategories(categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
        const bannerData = bannersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const activeBanners = bannerData.filter((b: any) => b.active !== false && b.active !== 'false');
        setBanners(activeBanners);

        // Handle reviews with fallback
        const firestoreReviews = reviewsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setReviews(firestoreReviews.length > 0 ? firestoreReviews : fallbackReviews);

      } catch (error: any) {
        if (error.code === 'resource-exhausted') {
          console.warn("Home Data: Firestore Quota reached. Content will load after reset.");
        } else {
          console.error("Error fetching home data:", error);
        }
        setReviews(fallbackReviews);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (reviews.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentReview((prev) => (prev + 1) % reviews.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [reviews.length]);

  const handleAddReview = async () => {
    if (!auth.currentUser) {
      toast.error("Please login to share your experience", {
        action: { label: "Login", onClick: () => navigate('/login') }
      });
      return;
    }

    if (!newReview.text.trim()) {
      toast.error("Please write something about your experience");
      return;
    }

    try {
      const colors = ['#5a4fcf', '#d85a30', '#0f6e56', '#993c1d', '#185fa5'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      const reviewData = {
        name: auth.currentUser.displayName || 'Anonymous User',
        initials: (auth.currentUser.displayName || 'U').charAt(0).toUpperCase(),
        color: randomColor,
        rating: newReview.rating,
        text: newReview.text,
        tag: newReview.tag || 'Fabric',
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        likes: 0,
        dislikes: 0,
        userId: auth.currentUser.uid,
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'fabric_reviews'), reviewData);
      
      setReviews([{ id: docRef.id, ...reviewData }, ...reviews.filter(r => !r.id.startsWith('f'))]);
      setIsReviewModalOpen(false);
      setNewReview({ rating: 5, text: '', tag: 'Fabric' });
      toast.success("Thank you for sharing your experience! ✨");
    } catch (error) {
      console.error("Error adding review:", error);
      toast.error("Failed to post review. Please try again.");
    }
  };

  const handleLike = async (id: string, isLike: boolean) => {
    // Optimistic UI update
    setReviews(prev => prev.map(r => {
      if (r.id === id) {
        return {
          ...r,
          likes: isLike ? (r.likes || 0) + 1 : (r.likes || 0),
          dislikes: !isLike ? (r.dislikes || 0) + 1 : (r.dislikes || 0)
        };
      }
      return r;
    }));
    
    try {
      const reviewRef = doc(db, 'fabric_reviews', id);
      await updateDoc(reviewRef, {
        [isLike ? 'likes' : 'dislikes']: increment(1)
      });
    } catch (error) {
      console.error("Error updating reaction:", error);
    }
  };

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      try {
        // Save to Firestore
        await addDoc(collection(db, 'newsletter'), {
          email,
          createdAt: new Date().toISOString(),
          userId: auth.currentUser?.uid || 'guest'
        });

        // Tag in OneSignal
        if (Capacitor.isNativePlatform()) {
          (OneSignal as any).sendTag("newsletter_subscriber", "true");
        } else if ((window as any).OneSignal) {
          await (window as any).OneSignal.User.addTag("newsletter_subscriber", "true");
        }

        toast.success("Welcome to the Ruby Circle! 💎");
        setEmail('');
      } catch (error) {
        console.error("Newsletter error:", error);
        toast.error("Failed to subscribe. Please try again.");
      }
    }
  };

  const filteredProducts = activeFilter === 'All' 
    ? trendingProducts 
    : trendingProducts.filter(p => p.category === activeFilter);

  const categoryIcons: Record<string, any> = {
    'Clothes': Shirt,
    'Shoes': Package, // Using Package as a fallback for shoes if needed
    'Bags': ShoppingBag,
    'Electronics': Laptop,
    'Watch': Watch,
    'Jewelry': Gem,
    'Kitchen': Utensils,
    'Toys': ToyBrick
  };

  return (
    <div className="bg-[#f2f2f2] min-h-screen pb-24">
      {/* Header (Not Sticky) */}
      <div className="bg-white border-b border-gray-100 px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <Link to="/profile" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <div className="w-11 h-11 rounded-full bg-[#c4a882] overflow-hidden flex items-center justify-center text-white font-bold">
              {auth.currentUser?.photoURL ? (
                <img src={auth.currentUser.photoURL} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User size={24} />
              )}
            </div>
            <div>
              <p className="text-[12px] text-gray-400 font-medium">Good Morning 👋</p>
              <p className="text-[17px] font-bold text-[#111] leading-tight">
                {auth.currentUser?.displayName || 'User'}
              </p>
            </div>
          </Link>
          <div className="flex items-center space-x-1">
            <Link 
              to="/notifications"
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-50 transition-colors relative"
            >
              <Bell size={22} className="text-[#111]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white pointer-events-none">
                  {unreadCount}
                </span>
              )}
            </Link>
            <Link to="/wishlist" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-50 transition-colors">
              <Heart size={22} className="text-[#111]" />
            </Link>
          </div>
        </div>
        
        {/* Search Bar */}
        <div 
          onClick={() => navigate('/search')}
          className="flex items-center bg-[#f5f5f5] rounded-2xl px-4 py-3 space-x-3 cursor-pointer group"
        >
          <Search size={17} className="text-gray-400 group-hover:text-ruby transition-colors" />
          <span className="text-sm text-gray-400 flex-grow">Search</span>
          <Filter size={20} className="text-gray-600" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 pt-6 space-y-8">
        {/* Promo Banner Carousel */}
        <div className="relative overflow-hidden rounded-[2rem] bg-white shadow-sm h-[180px]">
          {loading ? (
            <div className="h-full w-full bg-gray-100 animate-pulse flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-ruby/20 border-t-ruby rounded-full animate-spin" />
            </div>
          ) : banners.length > 0 ? (
            <div className="h-full">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentBanner}
                  initial={{ opacity: 0, x: 100 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="absolute inset-0 cursor-pointer"
                  onClick={() => banners[currentBanner].link && navigate(banners[currentBanner].link)}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -50) {
                      setCurrentBanner((prev) => (prev + 1) % banners.length);
                    } else if (info.offset.x > 50) {
                      setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length);
                    }
                  }}
                >
                  <img 
                    src={banners[currentBanner].image} 
                    alt="Promo Banner" 
                    className="w-full h-full object-cover"
                  />
                </motion.div>
              </AnimatePresence>
              
              {/* Pagination Dots */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-1.5 z-10">
                {banners.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentBanner(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      currentBanner === i ? 'w-4 bg-white shadow-sm' : 'w-1.5 bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-[#f0f0f0] h-full flex items-center justify-between px-8">
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-gray-600">40% OFF</p>
                <h2 className="text-xl font-bold text-[#111]">Today's Special</h2>
                <p className="text-[12px] text-gray-500 leading-relaxed">
                  Get a discount for every order!<br/>Only valid for today!
                </p>
              </div>
              <div className="text-[56px] font-black text-[#111] opacity-20">40%</div>
            </div>
          )}
        </div>

        {/* Categories */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[17px] font-bold text-[#111]">Categories</h3>
            <Link to="/shop" className="text-[13px] font-medium text-gray-600">See all</Link>
          </div>
          <div className="flex space-x-5 overflow-x-auto pb-2 scrollbar-hide">
            {loading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex flex-col items-center space-y-2 flex-shrink-0 animate-pulse">
                  <div className="w-[60px] h-[60px] rounded-full bg-gray-200" />
                  <div className="h-3 w-12 bg-gray-200 rounded" />
                </div>
              ))
            ) : categories.length > 0 ? (
              categories.map((cat) => {
                const Icon = categoryIcons[cat.name] || Package;
                return (
                  <Link 
                    key={cat.id} 
                    to={`/shop?category=${cat.name}`}
                    className="flex flex-col items-center space-y-2 flex-shrink-0 group"
                  >
                    <div className="w-[60px] h-[60px] rounded-full bg-[#f0f0f0] flex items-center justify-center group-hover:bg-ruby/10 transition-colors">
                      <Icon size={26} className="text-[#222] group-hover:text-ruby transition-colors" />
                    </div>
                    <span className="text-[12px] font-medium text-[#333]">{cat.name}</span>
                  </Link>
                );
              })
            ) : (
              <p className="text-xs text-gray-400 italic">No categories available.</p>
            )}
          </div>
        </div>

        {/* Most Popular / Trending */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[17px] font-bold text-[#111]">Most Popular</h3>
            <Link to="/shop" className="text-[13px] font-medium text-gray-600">See All</Link>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => <ProductCardSkeleton key={i} />)}
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {filteredProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-white rounded-3xl border border-dashed border-gray-200">
              <p className="text-gray-400 text-sm italic">No trending products found in this category.</p>
            </div>
          )}
        </div>

        {/* Testimonials */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[17px] font-bold text-[#111] max-w-[70%]">What customers say about our fabric</h3>
            <button 
              onClick={() => setIsReviewModalOpen(true)}
              className="flex items-center space-x-1.5 bg-white border border-gray-200 px-3 py-1.5 rounded-full text-[12px] font-bold text-ruby hover:bg-ruby/5 active:scale-95 transition-all shadow-sm"
            >
              <Plus size={14} />
              <span>Add Review</span>
            </button>
          </div>
          
          <div className="relative overflow-hidden rounded-2xl bg-white border border-gray-100 p-5 min-h-[180px] shadow-sm">
            {reviews.length > 0 ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentReview}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: reviews[currentReview].color || '#111' }}
                      >
                        {reviews[currentReview].initials}
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-[#111]">{reviews[currentReview].name}</p>
                        <div className="flex text-yellow-400">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              size={12} 
                              fill={i < reviews[currentReview].rating ? "currentColor" : "none"} 
                              className={i < reviews[currentReview].rating ? "" : "text-gray-300"}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-400 font-medium">
                      {reviews[currentReview].date || 'Just now'}
                    </span>
                  </div>

                  <p className="text-[13px] text-gray-600 leading-relaxed italic">
                    "{reviews[currentReview].text}"
                  </p>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center space-x-2">
                      <span className="bg-ruby/10 text-ruby text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                        {reviews[currentReview].tag}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <button 
                        onClick={() => handleLike(reviews[currentReview].id, true)}
                        className="flex items-center space-x-1 text-gray-400 hover:text-green-500 transition-colors"
                      >
                        <ThumbsUp size={14} />
                        <span className="text-[11px] font-bold">{reviews[currentReview].likes || 0}</span>
                      </button>
                      <button 
                        onClick={() => handleLike(reviews[currentReview].id, false)}
                        className="flex items-center space-x-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <ThumbsDown size={14} />
                        <span className="text-[11px] font-bold">{reviews[currentReview].dislikes || 0}</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="flex flex-col items-center justify-center h-[140px] text-gray-400 space-y-2">
                <Star size={24} className="opacity-20" />
                <p className="text-sm italic">Be the first to share your experience!</p>
              </div>
            )}
          </div>

          {reviews.length > 1 && (
            <div className="flex justify-center space-x-1.5">
              {reviews.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentReview(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    currentReview === i ? 'w-5 bg-ruby' : 'w-1.5 bg-gray-300'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Review Modal */}
        <AnimatePresence>
          {isReviewModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsReviewModalOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden relative z-10 flex flex-col shadow-2xl"
              >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0">
                  <h3 className="font-bold text-lg text-[#111]">Share Experience</h3>
                  <button onClick={() => setIsReviewModalOpen(false)} className="bg-gray-100 p-2 rounded-full hover:bg-gray-200 transition-colors">
                    <X size={18} className="text-gray-600" />
                  </button>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Rating Selector */}
                  <div className="space-y-2 text-center">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Rate the Fabric</p>
                    <div className="flex justify-center space-x-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setNewReview({ ...newReview, rating: star })}
                          className={`p-1 transition-all ${star <= newReview.rating ? 'scale-110' : 'opacity-30 grayscale'}`}
                        >
                          <Star 
                            size={32} 
                            fill={star <= newReview.rating ? "#ef4444" : "none"} 
                            className={star <= newReview.rating ? "text-ruby" : "text-gray-400"} 
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Text Input */}
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">Your Thoughts</label>
                    <textarea 
                      placeholder="Tell us about the fabric quality, color, or fit..."
                      value={newReview.text}
                      onChange={(e) => setNewReview({ ...newReview, text: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-ruby/30 transition-all placeholder:text-gray-400 resize-none"
                    />
                  </div>

                  {/* Tag Selection */}
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">Highlight</label>
                    <div className="flex flex-wrap gap-2">
                      {['Fabric', 'Color', 'Fit', 'Comfort', 'Quality'].map((tag) => (
                        <button
                          key={tag}
                          onClick={() => setNewReview({ ...newReview, tag })}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            newReview.tag === tag 
                              ? 'bg-ruby text-white' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-6 pt-0 mt-auto">
                  <button
                    onClick={handleAddReview}
                    className="w-full bg-ruby text-white py-4 rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-lg shadow-ruby/20 active:scale-95 transition-all"
                  >
                    Post Review
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Join the Ruby Circle */}
        <div className="bg-[#111] rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-ruby/20 blur-3xl rounded-full -mr-16 -mt-16"></div>
          <div className="relative z-10 space-y-2">
            <h3 className="text-2xl font-black text-white leading-tight">Join the Ruby Circle</h3>
            <p className="text-gray-400 text-sm">Get exclusive offers and early access to new drops.</p>
          </div>
          <form onSubmit={handleNewsletterSubmit} className="relative z-10 flex flex-col space-y-3">
            <input 
              type="email" 
              placeholder="Enter your Gmail"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="bg-white/10 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-ruby/50 transition-all placeholder:text-gray-500"
            />
            <button 
              type="submit"
              className="bg-ruby text-white py-4 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-ruby-dark transition-all shadow-lg shadow-ruby/20"
            >
              Subscribe Now
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
