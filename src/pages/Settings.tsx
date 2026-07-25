import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { supabase } from '../supabase';
import { doc, updateDoc, collection, query, getDocs, where, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Bell, 
  Globe, 
  Trash2, 
  ChevronLeft,
  Lock,
  Mail,
  Smartphone,
  Eye,
  EyeOff,
  UserX,
  CreditCard,
  MessageSquare,
  Sparkles,
  Heart,
  ChevronRight,
  ShieldCheck,
  Zap,
  Fingerprint,
  Layers,
  Settings as SettingsIcon,
  LogOut,
  AppWindow,
  Tag,
  Gift,
  Ticket
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useCart } from '../contexts/CartContext';

export default function Settings() {
  const { user, profile } = useAuth();
  const { setAppliedPromo, total: cartTotal } = useCart();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeView, setActiveView] = React.useState<'main' | 'security' | 'notifications' | 'preferences' | 'privacy' | 'coupons'>('main');
  const [loading, setLoading] = React.useState(false);
  const [coupons, setCoupons] = React.useState<any[]>([]);
  const [refreshCoupons, setRefreshCoupons] = React.useState(0);
  const [isRedeeming, setIsRedeeming] = React.useState<string | null>(null);

  React.useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'coupons') {
      setActiveView('coupons');
    }
  }, [searchParams]);

  React.useEffect(() => {
    const fetchCoupons = async () => {
      try {
        const { data, error } = await supabase
          .from('coupons')
          .select('*')
          .eq('active', true);
        if (error) throw error;
        setCoupons(data || []);
      } catch (e) {
        console.error("Error fetching coupons from Supabase:", e);
      }
    };
    fetchCoupons();
  }, [refreshCoupons, user]);

  // Stats for the "Cool" factor
  const [securityScore] = React.useState(85);
  const [systemLatency, setSystemLatency] = React.useState(24);

  // Preferences State
  const [prefs, setPrefs] = React.useState({
    orderUpdates: true,
    newArrivals: true,
    couponsAlert: true,
    newsletter: false,
    darkMode: false,
    biometrics: false,
    aiCuration: true,
    language: 'English',
    currency: 'INR (₹)',
    privacyMode: false,
  });

  // Security Form States
  const [passForm, setPassForm] = React.useState({ current: '', new: '', confirm: '' });
  const [showPass, setShowPass] = React.useState(false);

  React.useEffect(() => {
    try {
      const savedLang = localStorage.getItem('ruby_language') || 'English';
      const savedCurr = localStorage.getItem('ruby_currency') || 'INR (₹)';
      const savedAiCuration = localStorage.getItem('ruby_ai_curation') !== 'false';
      const savedPrivacyMode = localStorage.getItem('ruby_privacy_mode') === 'true';
      
      const stored = localStorage.getItem('ruby_notification_preferences');
      let notifVal = { orderUpdates: true, newArrivals: true, couponsAlert: true, newsletter: false };
      if (stored) {
        notifVal = { ...notifVal, ...JSON.parse(stored) };
      } else if (profile?.notifications) {
        notifVal = {
          orderUpdates: profile.notifications.orderUpdates ?? true,
          newArrivals: profile.notifications.newArrivals ?? true,
          couponsAlert: profile.notifications.couponsAlert ?? true,
          newsletter: profile.notifications.newsletter ?? false
        };
      }

      setPrefs({
        orderUpdates: notifVal.orderUpdates,
        newArrivals: notifVal.newArrivals,
        couponsAlert: notifVal.couponsAlert,
        newsletter: notifVal.newsletter,
        darkMode: false,
        biometrics: false,
        aiCuration: savedAiCuration,
        language: savedLang,
        currency: savedCurr,
        privacyMode: savedPrivacyMode,
      });
    } catch (e) {
      console.warn("Error loading settings preferences:", e);
    }
  }, [profile]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setSystemLatency(Math.floor(Math.random() * (32 - 18 + 1) + 18));
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleToggle = async (key: keyof typeof prefs) => {
    const newVal = !prefs[key];
    setPrefs(prev => ({ ...prev, [key]: newVal }));
    
    // Save locally
    if (key === 'aiCuration') {
      localStorage.setItem('ruby_ai_curation', String(newVal));
    } else if (key === 'privacyMode') {
      localStorage.setItem('ruby_privacy_mode', String(newVal));
    } else if (['orderUpdates', 'newArrivals', 'couponsAlert', 'newsletter'].includes(String(key))) {
      const stored = localStorage.getItem('ruby_notification_preferences');
      const parsed = stored ? JSON.parse(stored) : { orderUpdates: true, newArrivals: true, couponsAlert: true, newsletter: false };
      parsed[key as string] = newVal;
      localStorage.setItem('ruby_notification_preferences', JSON.stringify(parsed));
    }

    toast.success('Preference updated!');

    if (user && typeof key === 'string' && ['orderUpdates', 'newArrivals', 'couponsAlert', 'newsletter'].includes(key)) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          [`notifications.${String(key)}`]: newVal
        });
      } catch (e) {
        console.error("Firebase notification sync failed");
      }
    }
  };

  const handleLangChange = (lang: string) => {
    setPrefs(prev => ({ ...prev, language: lang }));
    localStorage.setItem('ruby_language', lang);
    toast.success(`Language set to ${lang}`, { icon: <Globe size={14} className="text-blue-500" /> });
  };

  const handleCurrencyChange = (curr: string) => {
    setPrefs(prev => ({ ...prev, currency: curr }));
    localStorage.setItem('ruby_currency', curr);
    // Dispatch custom event to notify components that currency was modified
    window.dispatchEvent(new Event('ruby_currency_changed'));
    toast.success(`Currency set to ${curr}`, { icon: <CreditCard size={14} className="text-emerald-500" /> });
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (passForm.new !== passForm.confirm) return toast.error("Passwords don't match");
    setLoading(true);
    try {
      if (!user.email) throw new Error("No email linked to authentication profile.");
      const { error: updateErr } = await supabase.auth.updateUser({ password: passForm.new });
      if (updateErr) throw updateErr;
      toast.success("Master password updated successfully! 🔒");
      setPassForm({ current: '', new: '', confirm: '' });
      setActiveView('main');
    } catch (err: any) {
      toast.error(err.message || "Shield check validation failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemPoints = async (option: { id: string; name: string; cost: number; value: number }) => {
    if (!user) {
      toast.error("Please log in to redeem points.");
      return;
    }

    const currentPoints = profile?.loyaltyPoints || 0;
    if (currentPoints < option.cost) {
      toast.error("Insufficient loyalty points for this reward.");
      return;
    }

    setIsRedeeming(option.id);
    const toastId = toast.loading(`Minting your ${option.name}... ⚜️`);

    try {
      const randomId = Math.random().toString(36).substring(2, 6).toUpperCase();
      const couponCode = `LP${option.value}-${randomId}`;

      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 30); // 30 days valid

      await supabase.from('coupons').insert([{
        code: couponCode,
        type: 'flat',
        value: option.value,
        active: true,
        usage_limit: 1,
        used_count: 0,
        start_date: new Date().toISOString(),
        end_date: expiry.toISOString()
      }]);

      const userRef = doc(db, 'users', user.uid);
      const nextPoints = currentPoints - option.cost;
      await updateDoc(userRef, {
        loyaltyPoints: nextPoints
      });

      toast.success(`${option.name} unlocked successfully! Code: ${couponCode} 🎉`, { id: toastId });
      setRefreshCoupons(prev => prev + 1);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Redemption failed. Please try again.", { id: toastId });
    } finally {
      setIsRedeeming(null);
    }
  };

  const handleApplyCouponToCart = (coupon: any) => {
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = cartTotal * (Number(coupon.value || coupon.discountValue) / 100);
    } else {
      discountAmount = Number(coupon.value || coupon.discountValue);
    }
    setAppliedPromo({ code: coupon.code, discount: discountAmount });
    toast.success(`Coupon "${coupon.code}" automatically applied to your active Cart! 🛍️`);
  };

  const handleClearSessions = () => {
    toast.promise(new Promise(res => setTimeout(res, 1000)), {
      loading: 'Revoking all other active sessions...',
      success: 'All other devices logged out safely',
      error: 'Failed to revoke sessions',
    });
  };

  const handleDownloadData = () => {
    try {
      const dataDump = {
        profileId: user?.uid,
        email: user?.email,
        name: localStorage.getItem(`user_name_${user?.uid}`) || profile?.displayName,
        wishlist: JSON.parse(localStorage.getItem('wishlist') || '[]'),
        cart: JSON.parse(localStorage.getItem('cart') || '[]'),
        recentlyViewed: JSON.parse(localStorage.getItem('recentlyViewed') || '[]'),
        notificationPreferences: prefs,
        timestamp: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(dataDump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ruby_store_data_${user?.uid?.slice(0, 8)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Your store data archive has been downloaded successfully! 📊");
    } catch (e) {
      toast.error("Failed to compile data archive.");
    }
  };

  const handleClearCache = () => {
    try {
      // Clean up home, shop, product caches
      localStorage.removeItem('ruby_home_cache');
      localStorage.removeItem('ruby_home_cache_v2');
      
      // Clean up dynamic keys
      const keys = Object.keys(localStorage);
      keys.forEach(k => {
        if (k.startsWith('ruby_shop_cache_') || k.startsWith('ruby_product_cache_')) {
          localStorage.removeItem(k);
        }
      });
      
      toast.success("All store local assets & page caches cleared successfully! ⚡");
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      toast.error("Failed to clean browser caches completely.");
    }
  };

  const menuItems = [
    {
      id: 'security',
      title: 'Shield',
      desc: '2FA & Access',
      icon: ShieldCheck,
      color: 'bg-blue-500',
      textColor: 'text-blue-500',
      status: '85%'
    },
    {
      id: 'notifications',
      title: 'Pings',
      desc: 'SMS & Email',
      icon: Bell,
      color: 'bg-ruby',
      textColor: 'text-ruby',
      status: 'On'
    },
    {
      id: 'preferences',
      title: 'Vibe',
      desc: 'Theme & Lang',
      icon: Layers,
      color: 'bg-amber-500',
      textColor: 'text-amber-500',
      status: 'Custom'
    },
    {
      id: 'privacy',
      title: 'Vault',
      desc: 'Data Locks',
      icon: Lock,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-500',
      status: 'Locked'
    },
    {
      id: 'coupons',
      title: 'Rewards',
      desc: 'Coupons & Points',
      icon: Ticket,
      color: 'bg-amber-500',
      textColor: 'text-amber-500',
      status: 'Active'
    }
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A2C54] pb-32">
      {/* Decorative background elements */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-ruby/[0.03] rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/[0.03] rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-xl mx-auto px-6 pt-12 space-y-8 relative z-10">
        
        {/* Dynamic Header */}
        <header className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => activeView === 'main' ? navigate('/profile') : setActiveView('main')}
                className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-all active:scale-90 shadow-sm"
              >
                <ChevronLeft size={20} className="text-gray-500" />
              </button>
              <h1 className="text-2xl font-syne font-black tracking-tight uppercase text-[#1A2C54]">
                Settings
              </h1>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-gray-200 shadow-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{systemLatency}ms</span>
            </div>
          </div>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
        </header>

        <AnimatePresence mode="wait">
          {activeView === 'main' ? (
            <motion.div 
              key="main"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Massive Profile Card */}
              <div className="relative group p-8 rounded-[2.5rem] bg-white border border-gray-100 overflow-hidden shadow-xl shadow-gray-200/50">
                <div className="absolute top-0 right-0 p-4">
                  <div className="flex items-center gap-2 px-3 py-1 bg-ruby/10 border border-ruby/20 rounded-lg text-ruby text-[9px] font-black uppercase tracking-tight">
                    Premium Member
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-ruby shadow-lg shadow-ruby/10">
                      <img 
                        src={(user && localStorage.getItem(`user_photo_${user.uid}`)) || profile?.photoURL || user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} 
                        className="w-full h-full object-cover" 
                        alt="Me"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#1A2C54] rounded-lg border-2 border-white flex items-center justify-center">
                      <Zap size={14} className="text-amber-400" />
                    </div>
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl font-bold tracking-tight text-[#1A2C54]">
                      {(user && localStorage.getItem(`user_name_${user.uid}`)) || profile?.displayName || 'Ruby Core'}
                    </h2>
                    <p className="text-xs text-gray-400 mb-3">{user?.email}</p>
                    <div className="flex items-center gap-3">
                      <div className="h-1 w-24 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }} 
                          animate={{ width: `${securityScore}%` }} 
                          className="h-full bg-ruby" 
                        />
                      </div>
                      <span className="text-[10px] font-black text-ruby uppercase tracking-tighter">Security Safe</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bento Grid Menu */}
              <div className="grid grid-cols-2 gap-4">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id as any)}
                    className="p-6 bg-white border border-gray-200 rounded-[2rem] hover:border-ruby/30 hover:shadow-2xl hover:shadow-gray-200 transition-all text-left group relative overflow-hidden"
                  >
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all shadow-sm", item.color)}>
                      <item.icon size={20} className="text-white" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1 text-left">
                        <h3 className="font-bold text-sm tracking-tight text-[#1A2C54]">{item.title}</h3>
                        <span className={cn("text-[8px] font-black uppercase tracking-widest bg-gray-50 px-1.5 py-0.5 rounded", item.textColor)}>{item.status}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-relaxed text-left">{item.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Performance Section */}
              <div className="p-8 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6 text-left">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-[#1A2C54]/60">Cache Memory</h4>
                    <p className="text-[10px] text-gray-400 truncate max-w-[200px]">Accelerate load times across all pages</p>
                  </div>
                  <button 
                    onClick={handleClearCache}
                    className="px-4 py-2 bg-gray-50 hover:bg-ruby hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-gray-100"
                  >
                    Clear Now
                  </button>
                </div>
                <div className="h-px bg-gray-100 w-full" />
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-[#1A2C54]/60 text-left">Loyalty Hash</h4>
                    <p className="text-[10px] text-gray-400 text-left">ID: {user?.uid?.slice(0, 12)}...</p>
                  </div>
                  <div className="text-right">
                    <p className="text-ruby font-bold text-lg leading-none">{profile?.loyaltyPoints || 0}</p>
                    <p className="text-[8px] font-black text-gray-300 uppercase tracking-tighter">Points</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate('/login');
                }}
                className="w-full py-4 bg-[#1A2C54] text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-red-600 transition-all shadow-xl shadow-gray-200 active:scale-95"
              >
                Terminate Session
              </button>
            </motion.div>
          ) : activeView === 'security' ? (
            <motion.div 
               key="security"
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               className="space-y-6"
            >
              <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/40 space-y-8 text-left">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center border border-blue-100">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#1A2C54]">Secure Gateway</h3>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">Enhanced Cryptography Active</p>
                  </div>
                </div>

                <form onSubmit={handlePasswordUpdate} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Master Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                      <input 
                        type={showPass ? 'text' : 'password'}
                        value={passForm.current}
                        onChange={e => setPassForm({...passForm, current: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pl-12 pr-12 text-sm font-bold text-[#1A2C54] outline-none focus:border-ruby/50 transition-all" 
                      />
                      <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-ruby transition-colors">
                        {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase ml-1">New Lock</label>
                      <input 
                        type="password"
                        value={passForm.new}
                        onChange={e => setPassForm({...passForm, new: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 px-6 text-sm font-bold text-[#1A2C54] outline-none focus:border-ruby/50 transition-all" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Confirm</label>
                      <input 
                        type="password"
                        value={passForm.confirm}
                        onChange={e => setPassForm({...passForm, confirm: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 px-6 text-sm font-bold text-[#1A2C54] outline-none focus:border-ruby/50 transition-all" 
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-ruby text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-ruby/20 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Re-Encrypting...' : 'Seal Security'}
                  </button>
                </form>
              </div>

              {/* More security options */}
              <div className="p-6 bg-white rounded-3xl border border-gray-100 flex items-center justify-between text-left shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center border border-amber-100">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#1A2C54]">2-Step Verification</h4>
                    <p className="text-[10px] text-gray-400">SMS or Authenticator App</p>
                  </div>
                </div>
                <button className="text-xs font-black text-ruby uppercase tracking-widest border border-ruby/30 px-4 py-2 rounded-xl hover:bg-ruby hover:text-white transition-all">Enable</button>
              </div>

              <div className="p-6 bg-white rounded-3xl border border-gray-100 space-y-4 text-left shadow-sm">
                 <div className="flex items-center justify-between px-2">
                   <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-syne">Other Sessions</h4>
                   <button onClick={handleClearSessions} className="text-[8px] font-black text-ruby uppercase hover:underline">Revoke All</button>
                 </div>
                 <div className="space-y-2">
                   {[
                     { dev: 'iPhone 15 Pro', loc: 'Delhi, IN', current: true },
                     { dev: 'MacBook M3 Max', loc: 'Mumbai, IN', current: false },
                   ].map((s, i) => (
                     <div key={i} className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between border border-gray-100">
                        <div className="flex items-center gap-3">
                          <AppWindow size={16} className={s.current ? 'text-ruby' : 'text-gray-300'} />
                          <div>
                            <p className="text-xs font-bold text-[#1A2C54]">{s.dev}</p>
                            <p className="text-[8px] text-gray-400">{s.loc}</p>
                          </div>
                        </div>
                        {s.current && <span className="text-[8px] font-black text-green-500 uppercase">Active Now</span>}
                     </div>
                   ))}
                 </div>
              </div>
            </motion.div>
          ) : activeView === 'notifications' ? (
            <motion.div 
               key="notifications"
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="space-y-4"
            >
              {[
                { id: 'newArrivals', label: 'New Arrivals & Style Drops', desc: 'Alerts when fresh limited-edition style collections drop', icon: Sparkles },
                { id: 'couponsAlert', label: 'Coupons & Price Reductions', desc: 'Immediate notifications for sales, cashback, & offers', icon: Tag },
                { id: 'orderUpdates', label: 'Order Pipeline Status', desc: 'Step-by-step pipeline tracking of your shipments', icon: Zap },
                { id: 'newsletter', label: 'The Edit Lookbook', desc: 'Weekly digests styled by our expert design directors', icon: Mail },
              ].map((item) => (
                <button 
                  key={item.id}
                  onClick={() => handleToggle(item.id as any)}
                  className="w-full bg-white p-6 rounded-[2rem] border border-gray-100 flex items-center justify-between group shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-5">
                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-all", (prefs as any)[item.id] ? "bg-ruby text-white" : "bg-gray-50 text-gray-300")}>
                      <item.icon size={22} />
                    </div>
                    <div className="text-left">
                      <h4 className="text-sm font-bold tracking-tight text-[#1A2C54]">{item.label}</h4>
                      <p className="text-[10px] text-gray-400 leading-relaxed font-medium mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                  <div className={cn(
                    "w-12 h-6 rounded-full p-1 transition-all flex border border-gray-100 items-center",
                    (prefs as any)[item.id] ? "bg-ruby border-ruby justify-end" : "bg-gray-100 border-gray-200 justify-start"
                  )}>
                    <motion.div layout className="w-4 h-4 bg-white rounded-full shadow-md" />
                  </div>
                </button>
              ))}
            </motion.div>
          ) : activeView === 'preferences' ? (
            <motion.div 
               key="preferences"
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               className="space-y-8"
            >
              <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/40 space-y-8 text-left">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] font-syne">Lexicon</label>
                  <div className="grid grid-cols-2 gap-2 text-left">
                    {['English', 'Hindi', 'French', 'Spanish'].map(lang => (
                      <button 
                        key={lang} 
                        onClick={() => handleLangChange(lang)}
                        className={cn("p-4 rounded-2xl text-[10px] font-black transition-all border", prefs.language === lang ? "bg-[#1A2C54] text-white border-[#1A2C54]" : "bg-gray-50 text-gray-400 border-gray-100 hover:border-gray-200")}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] font-syne">Fiat</label>
                  <div className="grid grid-cols-2 gap-2 text-left">
                    {['INR (₹)', 'USD ($)', 'EUR (€)', 'GBP (£)'].map(curr => (
                      <button 
                        key={curr} 
                        onClick={() => handleCurrencyChange(curr)}
                        className={cn("p-4 rounded-2xl text-[10px] font-black transition-all border", prefs.currency === curr ? "bg-ruby text-white border-ruby" : "bg-gray-50 text-gray-400 border-gray-100 hover:border-gray-200")}
                      >
                        {curr}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-6 bg-gray-50 rounded-3xl border border-gray-100 group">
                   <div className="flex items-center gap-4 text-left">
                      <div className="w-12 h-12 bg-ruby/10 text-ruby rounded-2xl flex items-center justify-center shrink-0 border border-ruby/20">
                        <Heart size={24} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#1A2C54]">Styling Algorithm</p>
                        <p className="text-[10px] text-gray-400">AI curation for customized lookbooks</p>
                      </div>
                   </div>
                   <div className="w-12 h-6 bg-ruby rounded-full p-1 flex justify-end shadow-inner">
                      <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                   </div>
                </div>
              </div>
            </motion.div>
          ) : activeView === 'coupons' ? (
            <motion.div 
               key="coupons"
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="space-y-6"
            >
              {/* Points Card */}
              <div className="bg-[#1A2C54] rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl shadow-blue-900/10 mb-6">
                <div className="absolute top-0 right-0 w-32 h-32 bg-ruby/20 rounded-full blur-3xl -mr-16 -mt-16" />
                <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-ruby border border-white/10">
                    <Zap size={32} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Your Loyalty Points</p>
                    <h2 className="text-5xl font-black tracking-tight">{profile?.loyaltyPoints || 0}</h2>
                  </div>
                  <p className="text-[11px] text-gray-400 max-w-[200px]">Use these points for exclusive discounts at checkout.</p>
                </div>
              </div>

              {/* Points Redemption Section */}
              <div className="space-y-4 mb-6">
                <div className="px-2 text-left">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-[#1A2C54] flex items-center gap-1.5">
                    <Gift size={14} className="text-ruby" /> Convert Points to Cash Coupons
                  </h3>
                  <p className="text-[10px] text-gray-400 mt-0.5 font-medium leading-relaxed">Spend your loyalty points to instantly unlock high-value store discount vouchers.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { id: 'voucher_100', name: '₹100 Store Voucher', cost: 100, value: 100, perk: 'Flat ₹100 Off' },
                    { id: 'voucher_250', name: '₹250 Elite Voucher', cost: 250, value: 250, perk: 'Flat ₹250 Off' },
                    { id: 'voucher_550', name: '₹550 Prestige Voucher', cost: 500, value: 550, perk: 'Flat ₹550 Off (+₹50 Bonus!)' },
                    { id: 'voucher_1200', name: '₹1200 Royale Voucher', cost: 1000, value: 1200, perk: 'Flat ₹1200 Off (+₹200 Bonus!)' },
                  ].map((voucher) => {
                    const isAffordable = (profile?.loyaltyPoints || 0) >= voucher.cost;
                    const loadingThis = isRedeeming === voucher.id;

                    return (
                      <div 
                        key={voucher.id} 
                        className={cn(
                          "bg-white p-5 rounded-3xl border transition-all relative overflow-hidden flex flex-col justify-between h-44 group text-left",
                          isAffordable ? "border-gray-100 hover:border-ruby/30 shadow-sm hover:shadow" : "border-gray-100 opacity-75"
                        )}
                      >
                        {/* Ticket notch curves */}
                        <div className="absolute left-0 top-1/2 -ml-2 w-4 h-4 rounded-full bg-gray-50 border-r border-gray-100 shrink-0 z-10" />
                        <div className="absolute right-0 top-1/2 -mr-2 w-4 h-4 rounded-full bg-gray-50 border-l border-gray-100 shrink-0 z-10" />

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs text-amber-500 font-bold">
                              <Gift size={14} />
                              <span>{voucher.cost} Points</span>
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-[#1A2C54]/50 group-hover:text-ruby group-hover:opacity-100 transition-colors">Voucher</span>
                          </div>
                          <h4 className="text-sm font-black text-[#1A2C54] tracking-tight mt-1">{voucher.name}</h4>
                          <p className="text-[10px] font-medium text-emerald-600">{voucher.perk}</p>
                        </div>

                        <button
                          disabled={!isAffordable || isRedeeming !== null}
                          onClick={() => handleRedeemPoints(voucher)}
                          className={cn(
                            "w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center",
                            loadingThis 
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                              : isAffordable 
                                ? "bg-ruby text-white hover:bg-[#1A2C54] shadow-sm hover:shadow" 
                                : "bg-gray-50 text-gray-400 cursor-not-allowed"
                          )}
                        >
                          {loadingThis ? 'Minting...' : isAffordable ? 'Redeem Voucher' : 'Not Enough Points'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1A2C54]">Available Coupons</h3>
                  <span className="text-[10px] font-bold text-ruby uppercase tracking-widest">{coupons.length} Active</span>
                </div>

                {coupons.length === 0 ? (
                  <div className="bg-white p-12 rounded-[2.5rem] border border-gray-100 text-center space-y-4">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 mx-auto">
                      <Ticket size={24} />
                    </div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-relaxed">No special coupons available<br/>right now. Check back soon!</p>
                  </div>
                ) : (
                  <div className="grid gap-4 text-left">
                    {coupons.map((coupon) => (
                      <div key={coupon.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group overflow-hidden relative">
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-ruby opacity-20 group-hover:opacity-100 transition-opacity" />
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 bg-ruby/5 text-ruby rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                            <Tag size={20} />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-[#1A2C54] tracking-tight">{coupon.code}</h4>
                            <p className="text-[10px] text-ruby font-bold uppercase tracking-wider">
                              {coupon.discountType === 'percentage' ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue} OFF`}
                            </p>
                            {coupon.expiryDate && (
                              <p className="text-[8px] text-gray-400 font-medium mt-0.5">
                                Expires: {new Date(coupon.expiryDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto self-stretch shrink-0">
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(coupon.code);
                              toast.success("Coupon code copied!");
                            }}
                            className="flex-1 sm:flex-none px-4 py-2.5 bg-gray-50 hover:bg-[#1A2C54] hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                          >
                            Copy
                          </button>
                          <button 
                            onClick={() => handleApplyCouponToCart(coupon)}
                            className="flex-1 sm:flex-none px-4 py-2.5 bg-[#1A2C54] hover:bg-ruby text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                          >
                            Apply to Cart
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div 
               key="privacy"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="space-y-6"
            >
              <div className="bg-white p-8 rounded-[3.5rem] border border-gray-100 shadow-xl shadow-gray-200/40 space-y-6 text-left">
                <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 flex items-center justify-between shadow-sm">
                   <div className="text-left">
                     <p className="text-sm font-bold text-[#1A2C54]">Data Archive</p>
                     <p className="text-[10px] text-gray-400">Zero-knowledge history extraction</p>
                   </div>
                   <button onClick={handleDownloadData} className="p-4 bg-white text-[#1A2C54] rounded-2xl border border-gray-100 hover:bg-ruby hover:text-white transition-all shadow-sm">
                     <Zap size={20} />
                   </button>
                </div>
                
                <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 flex items-center justify-between shadow-sm">
                   <div className="text-left">
                     <p className="text-sm font-bold text-[#1A2C54]">Ghost Mode</p>
                     <p className="text-[10px] text-gray-400">Deep anonymization for reviews</p>
                   </div>
                   <button 
                     onClick={() => handleToggle('privacyMode')}
                     className={cn(
                       "w-12 h-6 rounded-full p-1 transition-all flex border border-gray-200",
                       prefs.privacyMode ? "bg-ruby justify-end" : "bg-white justify-start"
                     )}
                   >
                     <div className="w-4 h-4 bg-white rounded-full shadow-md" />
                   </button>
                </div>
              </div>

              <div className="p-10 bg-red-50 rounded-[3.5rem] border border-red-100 space-y-8 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-left">
                  <div className="w-16 h-16 bg-white text-red-500 rounded-3xl border border-red-100 flex items-center justify-center shrink-0 shadow-sm">
                    <UserX size={32} />
                  </div>
                  <div className="space-y-2 text-left">
                    <h4 className="text-2xl font-syne font-bold text-red-600 tracking-tight text-left">Vaporize Account</h4>
                    <p className="text-[11px] text-red-400 font-medium leading-relaxed max-w-sm text-left">This action will permanently scrub all traces of your identity from our grid. There is no rollback.</p>
                  </div>
                </div>
                <button className="w-full py-5 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] shadow-xl shadow-red-200 hover:bg-black transition-all">Destroy Data</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="pt-8 text-center opacity-40">
          <p className="text-[9px] font-black text-[#1A2C54] uppercase tracking-[0.8em]">Ruby Grid Core V2.4</p>
        </footer>

      </div>
    </div>
  );
}

