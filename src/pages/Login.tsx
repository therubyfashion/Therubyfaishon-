import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { Mail, Lock, ArrowRight, LogIn, Smartphone } from 'lucide-react';
import PhoneVerification from '../components/PhoneVerification';

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [storeSettings, setStoreSettings] = useState<any>(null);
  const [showPhoneLogin, setShowPhoneLogin] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'settings'));
        if (!querySnapshot.empty) {
          setStoreSettings(querySnapshot.docs[0].data());
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const { user } = await signInWithPopup(auth, provider);
      
      // Ensure profile exists
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role: 'user',
          isVerified: true, // Google accounts are pre-verified
          createdAt: new Date().toISOString()
        });
      }
      
      toast.success("Welcome back to The Ruby!");
      navigate('/');
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        // Just return, no need to show error if user closed the window themselves
        return;
      }
      if (error.code === 'auth/account-exists-with-different-credential') {
        toast.error("Aapka account pehle se bana hai kisi aur method se (Google ya Email). Wahi use karke login karein.");
      } else {
        toast.error("Login nahi ho paaya. Dobara try karein.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      
      // Parallelize fetching user data and any other initial checks
      const userDocPromise = getDoc(doc(db, 'users', user.uid));
      
      const userDoc = await userDocPromise;
      const userData = userDoc.data();

      if (userData && !userData.isVerified) {
        toast.error("Please verify your email before logging in.");
        const userEmail = user.email;
        const userUid = user.uid;
        localStorage.removeItem('phone_user');
        // Keep user signed in for verification permissions
        navigate(`/verify-prompt?email=${encodeURIComponent(userEmail || '')}&uid=${userUid}`);
        return;
      }

      toast.success("Logged in successfully!");
      
      // Trigger Welcome Push & Email
      try {
        // Push
        fetch('/api/send-user-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            title: 'Welcome Back! ✨',
            body: `Hi ${userData?.name || 'Gorgeous'}, we missed you! Ready to shop?`,
            url: '/'
          })
        });

        // Email
        if (user.email) {
          fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: user.email,
              subject: 'Welcome Back to The Ruby! ✨',
              html: `
                <div style="font-family: sans-serif; padding: 20px; color: #1A2C54;">
                  <h1 style="color: #E11D48;">Welcome Back, ${userData?.name || 'Gorgeous'}!</h1>
                  <p>We're so glad to see you again. Your wardrobe has been waiting for you!</p>
                  <p>Check out our latest arrivals and find something special today.</p>
                  <a href="${window.location.origin}" style="display: inline-block; background: #E11D48; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">Start Shopping</a>
                </div>
              `
            })
          });
        }
      } catch (e) {
        console.error("Welcome notification error:", e);
      }

      navigate('/');
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        toast.error("Invalid email or password.");
      } else if (error.code === 'auth/network-request-failed') {
        toast.error("Network error! Please check your internet connection.");
      } else {
        toast.error(error.message || "Failed to sign in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Visual Sidebar */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#1a1a2e] relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#2d1b69] to-[#1a1a2e] opacity-90" />
        <div className="relative z-10 text-center space-y-8 max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            {storeSettings?.storeLogo ? (
              <img src={storeSettings.storeLogo} alt={storeSettings.storeName} className="h-16 md:h-20 object-contain mb-4" />
            ) : (
              <div className="text-5xl font-serif font-bold tracking-tighter text-white">
                {storeSettings?.storeName || 'The Ruby'}
              </div>
            )}
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-white/90 font-medium leading-relaxed"
          >
            Welcome back, gorgeous.<br />Your wardrobe awaits.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="text-7xl"
          >
            💃✨
          </motion.div>
        </div>
        
        {/* Decorative Circles */}
        <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-ruby/10 rounded-full blur-3xl" />
      </div>

      {/* Form Section */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-gray-50/50">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="max-w-md w-full space-y-8"
        >
          <div className="space-y-2">
            <h1 className="text-3xl font-serif font-bold text-[#1A2C54]">Welcome Back</h1>
            <p className="text-gray-400 font-medium">Sign in to continue shopping</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Email Address</label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-ruby transition-colors">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" 
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-gray-100 px-12 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-ruby/10 focus:border-ruby transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Password</label>
                <button type="button" className="text-xs font-bold text-ruby hover:underline">Forgot password?</button>
              </div>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-ruby transition-colors">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-gray-100 px-12 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-ruby/10 focus:border-ruby transition-all"
                  required
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-[#1A2C54] text-white py-4 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-ruby transition-all shadow-xl shadow-[#1A2C54]/10 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? "Signing In..." : (
                <>
                  Sign In
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="relative flex items-center gap-4 py-2">
            <div className="flex-grow border-t border-gray-100"></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">or sign in with</span>
            <div className="flex-grow border-t border-gray-100"></div>
          </div>

          <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-100 py-4 rounded-2xl text-sm font-bold text-[#1A2C54] hover:bg-gray-50 transition-all shadow-sm"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
            Google
          </button>

          <button 
            onClick={() => setShowPhoneLogin(true)}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-100 py-4 rounded-2xl text-sm font-bold text-[#1A2C54] hover:bg-gray-50 transition-all shadow-sm"
          >
            <Smartphone size={18} className="text-ruby" />
            Phone Number
          </button>

          {showPhoneLogin && (
            <PhoneVerification 
              onClose={() => setShowPhoneLogin(false)}
              onSuccess={() => {
                toast.success("Logged in with phone!");
                navigate('/');
              }}
            />
          )}

          <p className="text-center text-sm text-gray-400">
            New here? <Link to="/signup" className="text-ruby font-bold hover:underline ml-1">Create Account</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
