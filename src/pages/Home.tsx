import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBag, ArrowRight, Star, ShieldCheck, Truck, RotateCcw, 
  Search, Bell, Heart, User, Filter, ChevronRight, Package,
  Shirt, Smartphone, Watch, Laptop, ShoppingCart, Gem, Utensils, ToyBrick,
  Plus, ThumbsUp, ThumbsDown, X, Camera, Image as ImageIcon
} from 'lucide-react';
import { collection, getDocs, query, where, limit, orderBy, addDoc, doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Product, Category } from '../types';
import ProductCard from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/Skeleton';
import PromoTickerBar from '../components/PromoTickerBar';
import { toast } from 'sonner';
import { compressImage } from '../utils/imageUtils';
import { useAuth } from '../contexts/AuthContext';
import OneSignal from 'onesignal-cordova-plugin';
import { Capacitor } from '@capacitor/core';
import { useNotifications } from '../contexts/NotificationContext';

export default function Home() {
  const { user, profile } = useAuth();
  const [unreadCount] = useState(0); // Notifications context fallback if needed
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [popularProducts, setPopularProducts] = useState<Product[]>([]);
  const [promoConfig, setPromoConfig] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [currentReview, setCurrentReview] = useState(0);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [email, setEmail] = useState('');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, text: '', tag: 'Fabric', image: '' as string | null });
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
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

  const fallbackCategories = [
    { id: "kurti", name: "Kurti", image: "https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?auto=format&fit=crop&q=80&w=300", slug: "kurti" },
    { id: "sarees", name: "Sarees", image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=300", slug: "sarees" },
    { id: "lehengas", name: "Lehengas", image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=300", slug: "lehengas" },
    { id: "suits", name: "Suits", image: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=300", slug: "suits" }
  ];

  const fallbackBanners = [
    {
      id: "b1",
      title: "Festive Season Collection",
      image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=1200",
      link: "/shop",
      active: true
    },
    {
      id: "b2",
      title: "Elegant Pure Cotton Kurtas",
      image: "https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?auto=format&fit=crop&q=80&w=1200",
      link: "/shop?category=kurti",
      active: true
    }
  ];

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
      viewCount: 145,
      wishlistCount: 38,
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
      viewCount: 189,
      wishlistCount: 52,
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
      viewCount: 232,
      wishlistCount: 89,
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
      viewCount: 94,
      wishlistCount: 22,
      createdAt: new Date().toISOString()
    }
  ];

  // Load initial cached values to avoid showing skeleton loading and render instantly
  useEffect(() => {
    try {
      const cached = localStorage.getItem('ruby_home_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.trendingProducts) setTrendingProducts(parsed.trendingProducts);
        if (parsed.popularProducts) setPopularProducts(parsed.popularProducts);
        if (parsed.categories) setCategories(parsed.categories);
        if (parsed.banners) setBanners(parsed.banners);
        if (parsed.reviews) setReviews(parsed.reviews);
        if (parsed.promoConfig) setPromoConfig(parsed.promoConfig);
        setLoading(false); // Instantly turn off the skeleton loaders
      }
    } catch (e) {
      console.warn("Failed to load home cache:", e);
    }
  }, []);

  useEffect(() => {
    // Scroll to top
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const hasCache = localStorage.getItem('ruby_home_cache') !== null;
      if (!hasCache) {
        setLoading(true);
      }
      try {
        const trendingQuery = query(
          collection(db, 'products'), 
          where('isTrending', '==', true),
          limit(8)
        );

        const popularQuery = query(
          collection(db, 'products'), 
          where('isPopular', '==', true),
          limit(8)
        );

        const reviewsQuery = query(
          collection(db, 'fabric_reviews')
        );

        const [trendingSnap, popularSnap, categoriesSnap, bannersSnap, reviewsSnap, settingsSnap] = await Promise.all([
          getDocs(trendingQuery).catch((err) => { console.warn("Failed fetching trending:", err); return { docs: [], empty: true } as any; }),
          getDocs(popularQuery).catch((err) => { console.warn("Failed fetching popular:", err); return { docs: [], empty: true } as any; }),
          getDocs(collection(db, 'categories')).catch((err) => { console.warn("Failed fetching categories:", err); return { docs: [], empty: true } as any; }),
          getDocs(collection(db, 'banners')).catch((err) => { console.warn("Failed fetching banners:", err); return { docs: [], empty: true } as any; }),
          getDocs(reviewsQuery).catch((err) => { console.warn("Failed fetching reviews:", err); return { docs: [], empty: true } as any; }),
          getDocs(collection(db, 'settings')).catch((err) => { console.warn("Failed fetching settings:", err); return { docs: [], empty: true } as any; })
        ]);

        // Process Settings for Promo Ticker
        let promoConfigData = null;
        if (!settingsSnap.empty) {
          const rawSettings = settingsSnap.docs[0].data();
          promoConfigData = {
            promoEnabled: rawSettings.promoEnabled ?? false,
            promoType: rawSettings.promoType ?? 'timer',
            promoMessage: rawSettings.promoMessage ?? '🔥 Mega Sale Ends In:',
            promoEndDate: rawSettings.promoEndDate ?? '',
            promoScrolling: rawSettings.promoScrolling ?? false,
            promoBgColor: rawSettings.promoBgColor ?? '#A11B35',
            promoTextColor: rawSettings.promoTextColor ?? '#FFFFFF',
          };
          setPromoConfig(promoConfigData);
        }

        // Handle products with base fallback
        let trendingData = trendingSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        let popularData = popularSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));

        if (trendingData.length === 0 || popularData.length === 0) {
          const fallbackSnap = await getDocs(query(collection(db, 'products'), limit(12))).catch((err) => {
            console.warn("Failed fetching fallback products:", err);
            return { docs: [] } as any;
          });
          const totalFallback = fallbackSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));

          if (trendingData.length === 0) {
            trendingData = totalFallback.slice(0, 8);
          }
          if (popularData.length === 0) {
            popularData = totalFallback.slice(4, 12).length > 0 ? totalFallback.slice(4, 12) : totalFallback.slice(0, 8);
          }
        }

        // Final local fail-safe if database contains absolutely 0 products
        if (trendingData.length === 0) {
          trendingData = fallbackProducts.filter(p => p.isTrending);
        }
        if (popularData.length === 0) {
          popularData = fallbackProducts;
        }

        setTrendingProducts(trendingData);
        setPopularProducts(popularData);

        const sortedCats = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        sortedCats.sort((a, b) => {
          const orderA = a.sortOrder !== undefined ? Number(a.sortOrder) : 1000;
          const orderB = b.sortOrder !== undefined ? Number(b.sortOrder) : 1000;
          return orderA - orderB;
        });
        const finalCats = sortedCats.length > 0 ? sortedCats : fallbackCategories;
        setCategories(finalCats);
        
        const bannerData = bannersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const activeBanners = bannerData.filter((b: any) => b.active !== false && b.active !== 'false');
        const finalBanners = activeBanners.length > 0 ? activeBanners : fallbackBanners;
        setBanners(finalBanners);

        // Handle reviews with fallback
        const firestoreReviews = reviewsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        // Sort client-side to avoid needing an index and to show docs even if createdAt is missing
        firestoreReviews.sort((a, b) => {
          const dateA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
          const dateB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
        const finalReviews = firestoreReviews.length > 0 ? firestoreReviews : fallbackReviews;
        setReviews(finalReviews);

        // Save fresh sync to cache
        try {
          const cacheData = {
            trendingProducts: trendingData,
            popularProducts: popularData,
            categories: sortedCats,
            banners: activeBanners,
            reviews: finalReviews,
            promoConfig: promoConfigData,
            cachedAt: Date.now()
          };
          localStorage.setItem('ruby_home_cache', JSON.stringify(cacheData));
        } catch (e) {
          console.warn("Failed to write home cache:", e);
        }

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
    if (!user) {
      toast.error("Please login to share your experience", {
        action: { label: "Login", onClick: () => navigate('/login') }
      });
      return;
    }

    if (!newReview.text.trim()) {
      toast.error("Please write something about your experience");
      return;
    }

    setReviewLoading(true);
    const postToast = toast.loading("Posting your review...");

    try {
      const colors = ['#5a4fcf', '#d85a30', '#0f6e56', '#993c1d', '#185fa5'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      const reviewData = {
        name: profile?.displayName || user?.displayName || 'Anonymous User',
        initials: (profile?.displayName || user?.displayName || 'U').charAt(0).toUpperCase(),
        color: randomColor,
        rating: newReview.rating,
        text: newReview.text,
        tag: newReview.tag || 'Fabric',
        image: newReview.image || null,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        likes: 0,
        dislikes: 0,
        userId: user.uid,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'fabric_reviews'), reviewData);
      
      // Update local state with optimistic data (converting serverTimestamp to ISO for sorting if needed, but here we just prepend)
      const optimisticReview = { 
        ...reviewData, 
        id: docRef.id, 
        createdAt: new Date().toISOString() 
      };
      
      setReviews(prev => [optimisticReview, ...prev.filter(r => !r.id.startsWith('f'))]);
      setIsReviewModalOpen(false);
      setNewReview({ rating: 5, text: '', tag: 'Fabric', image: null });
      toast.success("Thank you for sharing your experience! ✨", { id: postToast });
    } catch (error) {
      console.error("Error adding review:", error);
      toast.error("Failed to post review. Please try again.", { id: postToast });
    } finally {
      setReviewLoading(false);
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
          userId: user?.uid || 'guest'
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

  const filteredTrendingProducts = activeFilter === 'All' 
    ? trendingProducts 
    : trendingProducts.filter(p => Array.isArray(p.category) ? p.category.includes(activeFilter) : p.category === activeFilter);

  const filteredPopularProducts = activeFilter === 'All' 
    ? popularProducts 
    : popularProducts.filter(p => Array.isArray(p.category) ? p.category.includes(activeFilter) : p.category === activeFilter);

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
              {(user && localStorage.getItem(`user_photo_${user.uid}`)) || profile?.photoURL || user?.photoURL ? (
                <img src={(user && localStorage.getItem(`user_photo_${user.uid}`)) || profile?.photoURL || user?.photoURL || ''} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.email || user?.uid || 'guest')}`} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              )}
            </div>
            <div>
              <p className="text-[12px] text-gray-400 font-medium">Good Morning 👋</p>
              <p className="text-[17px] font-bold text-[#111] leading-tight">
                {(user && localStorage.getItem(`user_name_${user.uid}`)) || profile?.displayName || user?.displayName || 'User'}
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
                    <div className="w-[60px] h-[60px] rounded-full bg-[#f0f0f0] flex items-center justify-center group-hover:bg-ruby/10 transition-colors overflow-hidden">
                      {cat.image ? (
                        <img 
                          src={cat.image} 
                          alt={cat.name} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" 
                        />
                      ) : (
                        <Icon size={26} className="text-[#222] group-hover:text-ruby transition-colors" />
                      )}
                    </div>
                    <span className="text-[12px] font-medium text-[#333] tracking-tight">{cat.name}</span>
                  </Link>
                );
              })
            ) : (
              <p className="text-xs text-gray-400 italic">No categories available.</p>
            )}
          </div>
        </div>

        {/* Trending Products */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[17px] font-bold text-[#111]">Trending Products</h3>
            <Link to="/shop" className="text-[13px] font-medium text-gray-600">See All</Link>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => <ProductCardSkeleton key={i} />)}
            </div>
          ) : filteredTrendingProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {filteredTrendingProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-white rounded-3xl border border-dashed border-gray-200">
              <p className="text-gray-400 text-sm italic">No trending products found in this category.</p>
            </div>
          )}
        </div>

        {/* Smart Promo Ticker Bar */}
        {promoConfig && promoConfig.promoEnabled && (
          <div className="my-6">
            <PromoTickerBar config={promoConfig} />
          </div>
        )}

        {/* Most Popular */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[17px] font-bold text-[#111]">Most Popular</h3>
            <Link to="/shop" className="text-[13px] font-medium text-gray-600">See All</Link>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => <ProductCardSkeleton key={i} />)}
            </div>
          ) : filteredPopularProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {filteredPopularProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-white rounded-3xl border border-dashed border-gray-200">
              <p className="text-gray-400 text-sm italic">No popular products found in this category.</p>
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

                  {reviews[currentReview].image && (
                    <div className="w-full h-32 rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
                      <img 
                        src={reviews[currentReview].image} 
                        alt="Review Attachment" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

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
                          type="button"
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

                  {/* Image Upload */}
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">Add Photos</label>
                    <div className="flex items-center space-x-3">
                      <label className="w-20 h-20 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 hover:border-ruby/30 transition-all group">
                        <Camera size={24} className="text-gray-400 group-hover:text-ruby" />
                        <span className="text-[10px] text-gray-400 font-bold mt-1">Upload</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = async () => {
                                const compressed = await compressImage(reader.result as string, 800, 800, 0.6);
                                setNewReview({ ...newReview, image: compressed });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      {newReview.image && (
                        <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-gray-100 group">
                          <img src={newReview.image} alt="Preview" className="w-full h-full object-cover" />
                          <button 
                            onClick={() => setNewReview({ ...newReview, image: null })}
                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={16} className="text-white" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-6 pt-0 mt-auto">
                  <button
                    onClick={handleAddReview}
                    disabled={reviewLoading}
                    className="w-full bg-ruby text-white py-4 rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-lg shadow-ruby/20 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                  >
                    {reviewLoading ? 'Posting...' : 'Post Review'}
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
