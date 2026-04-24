import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { signOut, updatePassword, updateEmail, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
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
  AppWindow
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Settings() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = React.useState<'main' | 'security' | 'notifications' | 'preferences' | 'privacy'>('main');
  const [loading, setLoading] = React.useState(false);

  // Stats for the "Cool" factor
  const [securityScore] = React.useState(85);
  const [systemLatency, setSystemLatency] = React.useState(24);

  // Preferences State
  const [prefs, setPrefs] = React.useState({
    orderUpdates: true,
    promotions: true,
    newsletter: false,
    darkMode: false,
    biometrics: false,
    language: 'English',
    currency: 'INR (₹)',
    privacyMode: false,
  });

  // Security Form States
  const [passForm, setPassForm] = React.useState({ current: '', new: '', confirm: '' });
  const [showPass, setShowPass] = React.useState(false);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setSystemLatency(Math.floor(Math.random() * (32 - 18 + 1) + 18));
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleToggle = async (key: keyof typeof prefs) => {
    const newVal = !prefs[key];
    setPrefs(prev => ({ ...prev, [key]: newVal }));
    
    // Simulate cloud sync with a "cool" toast
    toast.promise(new Promise(res => setTimeout(res, 800)), {
      loading: 'Syncing preferences...',
      success: 'Cloud Vault Updated',
      error: 'Sync Failed',
    });

    if (user && ['orderUpdates', 'promotions', 'newsletter'].includes(key)) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          [`notifications.${key}`]: newVal
        });
      } catch (e) {
        console.error("Firebase sync failed");
      }
    }
  };

  const handleLangChange = (lang: string) => {
    setPrefs(prev => ({ ...prev, language: lang }));
    toast.success(`Language set to ${lang}`, { icon: <Globe size={14} className="text-blue-500" /> });
  };

  const handleCurrencyChange = (curr: string) => {
    setPrefs(prev => ({ ...prev, currency: curr }));
    toast.success(`Currency set to ${curr}`, { icon: <CreditCard size={14} className="text-emerald-500" /> });
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;
    if (passForm.new !== passForm.confirm) return toast.error("Passwords don't match");
    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, passForm.current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, passForm.new);
      toast.success("Security vault updated!");
      setPassForm({ current: '', new: '', confirm: '' });
      setActiveView('main');
    } catch (err: any) {
      toast.error(err.message || "Shield check failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearSessions = () => {
    toast.promise(new Promise(res => setTimeout(res, 1500)), {
      loading: 'Revoking all other active sessions...',
      success: 'All other devices logged out safely',
      error: 'Failed to revoke sessions',
    });
  };

  const handleDownloadData = () => {
    toast.info("Preparing your data archive. We will email you a secure link within 24 hours.");
  };

  const handleClearCache = () => {
    toast.success("Local cache cleared. Reloading assets...");
    setTimeout(() => window.location.reload(), 1500);
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
                        src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} 
                        className="w-full h-full object-cover" 
                        alt="Me"
                      />
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#1A2C54] rounded-lg border-2 border-white flex items-center justify-center">
                      <Zap size={14} className="text-amber-400" />
                    </div>
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl font-bold tracking-tight text-[#1A2C54]">{profile?.displayName || 'Ruby Core'}</h2>
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
                  await signOut(auth);
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
                { id: 'orderUpdates', label: 'Order Pipeline', desc: 'Every milestone of your delivery journey', icon: Zap },
                { id: 'promotions', label: 'Ruby Drops', desc: 'Curated exclusivity & seasonal events', icon: Sparkles },
                { id: 'newsletter', label: 'The Edit', desc: 'Weekly lookbooks by our creative directors', icon: Mail },
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
                      <p className="text-[10px] text-gray-400 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                  <div className={cn(
                    "w-12 h-6 rounded-full p-1 transition-all flex border border-gray-100",
                    (prefs as any)[item.id] ? "bg-ruby justify-end" : "bg-gray-100 justify-start"
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

