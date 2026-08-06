import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBag, ArrowRight, Star, ShieldCheck, Truck, RotateCcw, 
  Search, Bell, Heart, User, Filter, ChevronRight, Package,
  Shirt, Smartphone, Watch, Laptop, ShoppingCart, Gem, Utensils, ToyBrick,
  Plus, ThumbsUp, ThumbsDown, X, Camera, Image as ImageIcon, ChevronDown
} from 'lucide-react';
import { supabase } from '../supabase';
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
import { checkProductHealth, logProductDiagnostics } from '../utils/productHealthCheck';

export default function Home() {
  const { user, profile } = useAuth();
  const { unreadCount } = useNotifications();
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [popularProducts, setPopularProducts] = useState<Product[]>([]);
  const [promoConfig, setPromoConfig] = useState<any>({ promoEnabled: false, promoMessage: "Welcome to The Ruby Ethnic Wear Store! 🎉" });
  const [categories, setCategories] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [bannersLoaded, setBannersLoaded] = useState(false);
  const [minLoadingActive, setMinLoadingActive] = useState(true);
  const [safetyTimeoutActive, setSafetyTimeoutActive] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinLoadingActive(false);
    }, 450); // 450ms minimum loader duration for smooth page transition
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSafetyTimeoutActive(false);
    }, 2500); // 2.5s safety timeout
    return () => clearTimeout(timer);
  }, []);

  const hasRealData = categories.length > 0 && trendingProducts.length > 0;
  const loading = minLoadingActive || (!hasRealData && safetyTimeoutActive);
  const [activeFilter, setActiveFilter] = useState('All');
  const [currentReview, setCurrentReview] = useState(0);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [email, setEmail] = useState('');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, text: '', tag: 'Fabric', image: '' as string | null });
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const navigate = useNavigate();

  const homeFaqs = [
    {
      question: "Delivery me kitne din lagte hain aur order track kaise karein?",
      answer: "Standard delivery poore India me 3 se 5 business days (metro cities) aur 5 se 7 days baki locations ke liye lagte hain. Order dispatch hone ke baad aapko WhatsApp & SMS par tracking link milti hai. Aap hamari website par 'Track Order' option se bhi live status check kar sakte hain."
    },
    {
      question: "Kya Cash on Delivery (COD) available hai?",
      answer: "Haan! Cash on Delivery (COD) aur Instant UPI payment poore India me 25,000+ pin codes par available hai. Delivery ke waqt aap cash ya UPI QR scan karke easily pay kar sakte hain."
    },
    {
      question: "Agar size fit nahi hua toh Return ya Exchange kaise karein?",
      answer: "Hum 7 days ka easy Return & Size Exchange policy dete hain. Agar size me koi issue ho toh aap 'My Orders' section se ya hamari support team se contact karke free doorstep reverse pickup arrange karwa sakte hain."
    },
    {
      question: "Fabric aur Embroidery ki quality kaisi hoti hai?",
      answer: "The Ruby Fashion par har product Premium Pure Cotton, Georgette, Chanderi & Silk fabric se banta hai. Inme high-density durable stitching aur genuine embroidery hoti hai jo washing ke baad bhi vibrant rehti hai."
    },
    {
      question: "Saree, Kurti aur Lehenga ke liye correct size kaise chunein?",
      answer: "Har product page par ek detailed Size Guide chart diya gaya hai jisme Bust, Waist, Hip aur Length in inches mention hain. Agar aap do sizes ke beech me hain, toh comfortable fit ke liye ek size bada chunein."
    }
  ];

  // Load initial cached values to avoid showing skeleton loading and render instantly
  useEffect(() => {
    try {
      const cached = localStorage.getItem('ruby_home_cache_v2');
      if (cached) {
        const parsed = JSON.parse(cached);
        // Clean cache of old fallback items to prevent flash of dummy data
        const hasDummy = (parsed.trendingProducts && parsed.trendingProducts.some((p: any) => !p.id || String(p.id).length < 10 || String(p.id).startsWith('fp') || String(p.id).startsWith('fb_'))) ||
                         (parsed.popularProducts && parsed.popularProducts.some((p: any) => !p.id || String(p.id).length < 10 || String(p.id).startsWith('fp') || String(p.id).startsWith('fb_'))) ||
                         (parsed.categories && parsed.categories.some((c: any) => !c.id || String(c.id).length < 10 || String(c.id).startsWith('fb_')));
        if (hasDummy) {
          localStorage.removeItem('ruby_home_cache_v2');
        } else {
          if (parsed.trendingProducts && parsed.trendingProducts.length > 0) setTrendingProducts(parsed.trendingProducts);
          if (parsed.popularProducts && parsed.popularProducts.length > 0) setPopularProducts(parsed.popularProducts);
          if (parsed.categories && parsed.categories.length > 0) {
            setCategories(parsed.categories);
          }
          if (parsed.banners && parsed.banners.length > 0) setBanners(parsed.banners);
          if (parsed.reviews && parsed.reviews.length > 0) setReviews(parsed.reviews);
          if (parsed.promoConfig) setPromoConfig(parsed.promoConfig);
          setCategoriesLoaded(true);
          setProductsLoaded(true);
          setBannersLoaded(true);
        }
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
    let finalReviews: any[] = [];
    let promoConfigData: any = null;

    const cacheAndSave = (key: string, data: any) => {
      try {
        const cached = localStorage.getItem('ruby_home_cache_v2');
        const parsed = cached ? JSON.parse(cached) : {};
        parsed[key] = data;
        parsed.cachedAt = Date.now();
        localStorage.setItem('ruby_home_cache_v2', JSON.stringify(parsed));
      } catch (e) {
        console.warn("Failed to write home cache:", e);
      }
    };

    const fetchHomeSupabaseData = async () => {
      try {
        // 1. Fetch Categories
        const { data: catData, error: catErr } = await supabase
          .from('categories')
          .select('*')
          .order('sort_order', { ascending: true });

        if (catErr) {
          console.warn("Home categories fetch error:", catErr);
        }

        const categoryMap: Record<string, string> = {};
        const mappedCats = (catData || []).map(c => {
          categoryMap[c.id] = c.name;
          return {
            id: c.id,
            name: c.name,
            slug: c.slug,
            image: c.image || null,
            sortOrder: c.sort_order ?? 1000,
          };
        });
        setCategories(mappedCats);
        cacheAndSave('categories', mappedCats);
        setCategoriesLoaded(true);

        // 2. Fetch Banners
        const { data: bannerData, error: bannerErr } = await supabase
          .from('banners')
          .select('*');

        if (bannerErr) {
          console.warn("Home banners fetch error:", bannerErr);
        }

        const mappedBanners = (bannerData || []).map(b => ({
          id: b.id,
          image: b.image || '',
          title: b.title || '',
          subtitle: b.subtitle || '',
          link: b.link || '',
          active: b.active ?? true,
          createdAt: b.created_at || new Date().toISOString()
        }));

        const activeBanners = mappedBanners.filter(b => b.active !== false);
        setBanners(activeBanners);
        cacheAndSave('banners', activeBanners);
        setBannersLoaded(true);

        // 3. Fetch Products - Trending and Popular sections with exact filters
        const [trendingRes, popularRes] = await Promise.all([
          supabase.from('products').select('*').eq('is_trending', true).order('created_at', { ascending: false }),
          supabase.from('products').select('*').eq('is_popular', true).order('created_at', { ascending: false })
        ]);

        if (trendingRes.error) {
          console.warn("Home trending products fetch error:", trendingRes.error);
        }
        if (popularRes.error) {
          console.warn("Home popular products fetch error:", popularRes.error);
        }

        const mapProduct = (p: any): Product => ({
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
        });

        const trendingData = (trendingRes.data || []).map(mapProduct);
        const popularData = (popularRes.data || []).map(mapProduct);

        console.log(`[Product Diagnostic - Query Result Count] Trending: ${trendingData.length}, Popular: ${popularData.length}`);

        // Run health checks & log diagnostics
        [...trendingData, ...popularData].forEach(p => {
          const health = checkProductHealth(p);
          if (!health.isValid) {
            console.warn(`[Product Diagnostic - Health Check Warning] Product "${p.name}" (${p.id}) has health issues:`, health.errors, health.warnings);
          }
          logProductDiagnostics('Rendered', p);
        });

        setTrendingProducts(trendingData);
        setPopularProducts(popularData);
        setProductsLoaded(true);
        cacheAndSave('trendingProducts', trendingData);
        cacheAndSave('popularProducts', popularData);
        // Fetch reviews
        try {
          const { data: revData } = await supabase.from('reviews').select('*').order('created_at', { ascending: false });
          if (revData) {
            const formattedRevs = revData.map((a: any) => ({
              id: a.id,
              name: a.user_name || a.name || 'Anonymous User',
              initials: (a.user_name || a.name || 'U').charAt(0).toUpperCase(),
              color: a.color || '#5a4fcf',
              rating: a.rating || 5,
              text: a.comment || a.text || '',
              tag: a.tag || 'Fabric',
              image: a.image || null,
              date: new Date(a.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              likes: a.likes || 0,
              dislikes: a.dislikes || 0,
              createdAt: a.created_at
            }));
            setReviews(formattedRevs);
            cacheAndSave('reviews', formattedRevs);
          }
        } catch (e) {
          console.warn("Error fetching reviews:", e);
        }

        // Fetch settings
        try {
          const { data: settsData } = await supabase.from('settings').select('*').limit(1);
          if (settsData && settsData.length > 0) {
            const rawSettings = settsData[0];
            promoConfigData = {
              promoEnabled: rawSettings.promo_enabled ?? rawSettings.promoEnabled ?? false,
              promoType: rawSettings.promo_type ?? rawSettings.promoType ?? 'timer',
              promoMessage: rawSettings.promo_message ?? rawSettings.promoMessage ?? '🔥 Mega Sale Ends In:',
              promoEndDate: rawSettings.promo_end_date ?? rawSettings.promoEndDate ?? '',
              promoScrolling: rawSettings.promo_scrolling ?? rawSettings.promoScrolling ?? false,
              promoBgColor: rawSettings.promo_bg_color ?? rawSettings.promoBgColor ?? '#A11B35',
              promoTextColor: rawSettings.promo_text_color ?? rawSettings.promoTextColor ?? '#FFFFFF',
            };
            setPromoConfig(promoConfigData);
            cacheAndSave('promoConfig', promoConfigData);
          }
        } catch (e) {
          console.warn("Error fetching settings:", e);
        }
      } catch (error) {
        console.warn("Error loading home data from Supabase:", error);
        setCategoriesLoaded(true);
        setBannersLoaded(true);
        setProductsLoaded(true);
      }
    };

    fetchHomeSupabaseData();

    // Set up real-time postgres changes channel for Home
    const homeChannel = supabase
      .channel('home-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => { fetchHomeSupabaseData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'banners' }, () => { fetchHomeSupabaseData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => { fetchHomeSupabaseData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => { fetchHomeSupabaseData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => { fetchHomeSupabaseData(); })
      .subscribe();

    return () => {
      supabase.removeChannel(homeChannel);
    };
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
      
      const { data: inserted, error } = await supabase.from('reviews').insert([{
        user_name: profile?.displayName || user?.displayName || 'Anonymous User',
        color: randomColor,
        rating: newReview.rating,
        comment: newReview.text,
        tag: newReview.tag || 'Fabric',
        image: newReview.image || null,
        likes: 0,
        dislikes: 0,
        user_id: user.uid,
        created_at: new Date().toISOString()
      }]).select().single();
      
      const newId = inserted ? inserted.id : 'rev_' + Date.now();
      const optimisticReview = { 
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
        id: newId, 
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
      const currentReviewItem = reviews.find(r => r.id === id);
      const field = isLike ? 'likes' : 'dislikes';
      const count = ((currentReviewItem as any)?.[field] || 0) + 1;
      await supabase.from('reviews').update({ [field]: count }).eq('id', id);
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
        // Save to Supabase
        await supabase.from('newsletter').insert([{
          email,
          created_at: new Date().toISOString(),
          user_id: user?.uid || 'guest'
        }]);

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
    'Kurti': Shirt,
    'Sarees': Gem,
    'Lehengas': Gem,
    'Suits': Shirt,
    'Dupatta': Shirt,
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
      {/* Header (Mobile Only) */}
      <div className="bg-white border-b border-gray-100 px-5 py-4 md:hidden">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 md:space-y-12">
        {/* Promo Banner Carousel */}
        <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-white shadow-sm h-48 md:h-80 lg:h-[420px] w-full">
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
                    className="w-full h-full object-cover md:object-cover md:w-full"
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
          <div className="flex flex-row overflow-x-auto gap-4 sm:gap-5.5 pb-3 scrollbar-hide no-scrollbar px-1">
            {loading ? (
              [1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="flex flex-col items-center space-y-2 flex-shrink-0 animate-pulse">
                  <div className="w-20 h-20 sm:w-22 sm:h-22 md:w-24 md:h-24 rounded-full bg-gray-200 shrink-0" />
                  <div className="h-3.5 w-14 bg-gray-200 rounded" />
                </div>
              ))
            ) : categories.length > 0 ? (
              categories.map((cat) => {
                const Icon = categoryIcons[cat.name] || Package;
                return (
                  <Link 
                    key={cat.id} 
                    to={`/shop?category=${encodeURIComponent(cat.name)}`}
                    className="flex flex-col items-center space-y-2 flex-shrink-0 group w-20 sm:w-22 md:w-24"
                  >
                    <div className="w-20 h-20 sm:w-22 sm:h-22 md:w-24 md:h-24 rounded-full bg-[#f0f0f0] flex items-center justify-center group-hover:bg-ruby/10 transition-all duration-300 overflow-hidden shrink-0 border border-gray-200/80 group-hover:shadow-md group-hover:scale-105">
                      {cat.image ? (
                        <img 
                          src={cat.image} 
                          alt={cat.name} 
                          className="w-full h-full object-cover rounded-full group-hover:scale-110 transition-transform duration-300" 
                        />
                      ) : (
                        <Icon size={28} className="text-[#222] group-hover:text-ruby transition-colors" />
                      )}
                    </div>
                    <span className="text-xs sm:text-[13px] font-semibold text-[#222] tracking-tight text-center truncate w-full">{cat.name}</span>
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <ProductCardSkeleton key={i} />)}
            </div>
          ) : filteredTrendingProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <ProductCardSkeleton key={i} />)}
            </div>
          ) : filteredPopularProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
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

        {/* Frequently Asked Questions Section */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[17px] font-bold text-[#111]">Frequently Asked Questions</h3>
              <p className="text-[11px] text-gray-500 font-medium">Quick answers regarding delivery, COD, returns & product quality</p>
            </div>
            <Link 
              to="/faq" 
              className="text-[12px] font-bold text-[#A11B35] hover:underline flex items-center gap-1 shrink-0"
            >
              <span>View All</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm space-y-2.5">
            {homeFaqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div 
                  key={index} 
                  className="border-b border-gray-100 last:border-none pb-2.5 last:pb-0"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full flex items-center justify-between py-2 text-left group gap-3 cursor-pointer"
                  >
                    <span className="text-[13px] sm:text-sm font-bold text-[#111] group-hover:text-[#A11B35] transition-colors leading-snug">
                      {faq.question}
                    </span>
                    <div className={`p-1 rounded-full transition-transform duration-300 shrink-0 ${isOpen ? 'bg-[#A11B35]/10 text-[#A11B35] rotate-180' : 'bg-gray-100 text-gray-400'}`}>
                      <ChevronDown size={16} />
                    </div>
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <p className="text-[12px] sm:text-[13px] text-gray-600 leading-relaxed pt-1 pb-2 pl-0.5">
                          {faq.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
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
