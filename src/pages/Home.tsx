import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, ArrowRight, Star, ShieldCheck, Truck, RotateCcw, 
  Search, Bell, Heart, User, Filter, ChevronRight, Package,
  Shirt, Smartphone, Watch, Laptop, ShoppingCart, Gem, Utensils, ToyBrick
} from 'lucide-react';
import { collection, getDocs, query, where, limit, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Product, Category } from '../types';
import ProductCard from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/Skeleton';
import { toast } from 'sonner';

export default function Home() {
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [currentReview, setCurrentReview] = useState(0);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  const reviews = [
    {
      id: 1,
      name: "Priya R.",
      initials: "PR",
      color: "#5a4fcf",
      rating: 5,
      text: "The fabric quality is absolutely amazing. The cotton feels so soft and breathable — wore it all day and stayed comfortable throughout!",
      tag: "Fabric quality"
    },
    {
      id: 2,
      name: "Arjun M.",
      initials: "AM",
      color: "#d85a30",
      rating: 4,
      text: "Doesn't fade after multiple washes. The stitching is solid and the fabric holds shape well. Great durability for the price!",
      tag: "Durability"
    },
    {
      id: 3,
      name: "Sneha K.",
      initials: "SK",
      color: "#0f6e56",
      rating: 5,
      text: "Loved the premium linen blend. Lightweight yet sturdy — perfect for Indian summers. Will definitely order more from this store!",
      tag: "Summer comfort"
    },
    {
      id: 4,
      name: "Rahul V.",
      initials: "RV",
      color: "#993c1d",
      rating: 4,
      text: "The fabric feels genuinely premium. No synthetic smell, drapes beautifully. You can tell it's good quality the moment you touch it.",
      tag: "Premium feel"
    },
    {
      id: 5,
      name: "Neha K.",
      initials: "NK",
      color: "#185fa5",
      rating: 5,
      text: "Skeptical about buying online but the fabric exceeded expectations. Texture is smooth, colors are vibrant and didn't bleed at all!",
      tag: "Color retention"
    }
  ];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch Trending Products
        const productsQuery = query(
          collection(db, 'products'), 
          where('isTrending', '==', true),
          limit(8)
        );
        const productsSnap = await getDocs(productsQuery);
        const productsData = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setTrendingProducts(productsData);

        // Fetch Categories
        const categoriesSnap = await getDocs(collection(db, 'categories'));
        setCategories(categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // Fetch Banners
        const bannersSnap = await getDocs(query(collection(db, 'banners'), where('active', '==', true)));
        setBanners(bannersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching home data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentReview((prev) => (prev + 1) % reviews.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [reviews.length]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      // In a real app, you'd save this to Firestore
      toast.success("Welcome to the Ruby Circle! 💎");
      setEmail('');
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
                {auth.currentUser?.displayName || 'Andrew Ainsley'}
              </p>
            </div>
          </Link>
          <div className="flex items-center space-x-1">
            <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-50 transition-colors">
              <Bell size={22} className="text-[#111]" />
            </button>
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
          {banners.length > 0 ? (
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
            {categories.length > 0 ? categories.map((cat) => {
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
            }) : (
              ['Clothes', 'Shoes', 'Bags', 'Electronics', 'Watch', 'Jewelry', 'Kitchen', 'Toys'].map((name) => {
                const Icon = categoryIcons[name] || Package;
                return (
                  <div key={name} className="flex flex-col items-center space-y-2 flex-shrink-0">
                    <div className="w-[60px] h-[60px] rounded-full bg-[#f0f0f0] flex items-center justify-center">
                      <Icon size={26} className="text-[#222]" />
                    </div>
                    <span className="text-[12px] font-medium text-[#333]">{name}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Most Popular / Trending */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[17px] font-bold text-[#111]">Most Popular</h3>
            <Link to="/shop" className="text-[13px] font-medium text-gray-600">See All</Link>
          </div>
          
          <div className="flex space-x-2.5 overflow-x-auto pb-2 scrollbar-hide">
            {['All', 'Clothes', 'Shoes', 'Bags', 'Electronics'].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-5 py-2 rounded-full text-[13px] font-semibold border-2 transition-all whitespace-nowrap ${
                  activeFilter === filter 
                    ? 'bg-[#111] text-white border-[#111]' 
                    : 'bg-white text-[#333] border-gray-200'
                }`}
              >
                {filter}
              </button>
            ))}
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
          <h3 className="text-[17px] font-bold text-[#111]">What customers say about our fabric</h3>
          <div className="relative overflow-hidden rounded-2xl bg-[#f8f8f8] p-5 min-h-[160px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentReview}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="space-y-4"
              >
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: reviews[currentReview].color }}
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
                <p className="text-[13px] text-gray-600 leading-relaxed italic">
                  "{reviews[currentReview].text}"
                </p>
                <span className="inline-block bg-[#ebe9ff] text-[#5a4fcf] text-[11px] font-semibold px-3 py-1 rounded-full">
                  {reviews[currentReview].tag}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex justify-center space-x-1.5">
            {reviews.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentReview(i)}
                className={`h-2 rounded-full transition-all ${
                  currentReview === i ? 'w-5 bg-[#111]' : 'w-2 bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>

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
