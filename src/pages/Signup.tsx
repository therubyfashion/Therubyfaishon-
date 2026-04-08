import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { Mail, Lock, User, ArrowRight, Phone, CheckCircle2 } from 'lucide-react';

export default function Signup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [storeSettings, setStoreSettings] = useState<any>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    agreeTerms: false
  });

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
      await signInWithPopup(auth, provider);
      toast.success("Welcome to The Ruby!");
      navigate('/');
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.code === 'auth/account-exists-with-different-credential') {
        toast.error("You already have an account with this email using a different login method (e.g., Google or Email). Please use your original method to sign in.");
      } else {
        toast.error("Failed to login. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.agreeTerms) {
      toast.error("Please agree to the Terms & Conditions");
      return;
    }
    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      
      const fullName = `${formData.firstName} ${formData.lastName}`;
      await updateProfile(user, { displayName: fullName });

      // Generate verification token
      const verificationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const verificationLink = `${window.location.origin}/verify-email?uid=${user.uid}&token=${verificationToken}`;

      // Create Firestore Profile
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: formData.email,
        displayName: fullName,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phone,
        role: 'user',
        isVerified: false,
        phoneVerified: false,
        verificationToken: verificationToken,
        createdAt: new Date().toISOString()
      });

      // Send Verification Email
      const emailHtml = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #FAFAFA; padding: 40px 20px; color: #1A2C54;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 40px; padding: 60px; box-shadow: 0 20px 50px -20px rgba(0,0,0,0.08); border: 1px solid #F0F0F0;">
            <div style="text-align: center; margin-bottom: 50px;">
              ${storeSettings?.storeLogo ? `<img src="${storeSettings.storeLogo}" alt="${storeSettings.storeName}" style="max-height: 60px; margin-bottom: 10px;">` : `<h1 style="font-size: 32px; font-weight: bold; letter-spacing: -1px; margin: 0; color: #E11D48;">${storeSettings?.storeName?.toUpperCase() || 'THE RUBY'}</h1>`}
            </div>
            
            <div style="text-align: center; margin-bottom: 40px;">
              <div style="display: inline-block; background-color: #FDF2F8; color: #E11D48; padding: 12px 24px; border-radius: 100px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 24px;">Welcome to the Family</div>
              <h2 style="font-size: 28px; font-weight: bold; margin: 0 0 16px 0; color: #1A2C54;">Welcome, ${formData.firstName}! ✨</h2>
              <p style="font-size: 16px; color: #666666; line-height: 1.6; margin: 0;">We're thrilled to have you with us. To start your premium shopping experience, please verify your email address by clicking the button below.</p>
            </div>

            <div style="text-align: center; margin-bottom: 50px;">
              <a href="${verificationLink}" style="display: inline-block; background-color: #1A2C54; color: #FFFFFF; padding: 20px 40px; border-radius: 16px; text-decoration: none; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; box-shadow: 0 10px 20px -5px rgba(26,44,84,0.3);">Verify My Account</a>
            </div>

            <div style="background-color: #F9FAFB; border-radius: 24px; padding: 32px; margin-bottom: 40px; border: 1px solid #F3F4F6; text-align: center;">
              <p style="font-size: 14px; color: #666666; margin: 0;">If the button doesn't work, you can also copy and paste this link into your browser:</p>
              <p style="font-size: 12px; color: #9CA3AF; margin: 12px 0 0 0; word-break: break-all;">${verificationLink}</p>
            </div>

            <div style="text-align: center; border-top: 1px solid #F0F0F0; pt-40px;">
              <p style="font-size: 14px; color: #9CA3AF; margin-bottom: 24px;">This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
              <p style="font-size: 16px; font-weight: bold; color: #1A2C54; margin: 0;">Happy Shopping!</p>
              <p style="font-size: 14px; color: #E11D48; font-weight: bold; margin: 4px 0 0 0;">Team ${storeSettings?.storeName || 'The Ruby'}</p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 40px;">
            <p style="font-size: 12px; color: #9CA3AF;">&copy; ${new Date().getFullYear()} ${storeSettings?.storeName || 'The Ruby'}. All rights reserved.</p>
          </div>
        </div>
      `;

      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: formData.email,
          subject: 'Welcome to The Ruby - Verify Your Email ✨',
          html: emailHtml
        })
      });

      await signOut(auth);
      toast.success("Verification email sent! Please check your inbox.");
      navigate(`/verify-prompt?email=${encodeURIComponent(formData.email)}&uid=${user.uid}`);
    } catch (error: any) {
      console.error("Signup error:", error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error("Email already in use. Please sign in.");
      } else {
        toast.error("Failed to create account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Visual Sidebar */}
      <div className="hidden lg:flex lg:w-1/2 bg-ruby relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-ruby via-[#E11D48] to-[#9F1239] opacity-90" />
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
            Discover curated women's fashion.<br />Style that speaks to you.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="text-7xl"
          >
            👗✨
          </motion.div>
        </div>
        
        {/* Decorative Circles */}
        <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-black/10 rounded-full blur-3xl" />
      </div>

      {/* Form Section */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-gray-50/50">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="max-w-md w-full space-y-8"
        >
          <div className="space-y-2">
            <h1 className="text-3xl font-serif font-bold text-[#1A2C54]">Create Account</h1>
            <p className="text-gray-400 font-medium">Join thousands of fashion lovers</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">First Name</label>
                <input 
                  type="text"
                  placeholder="Enter your first name"
                  value={formData.firstName}
                  onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                  className="w-full bg-white border border-gray-100 px-5 py-3.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ruby/10 focus:border-ruby transition-all"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Last Name</label>
                <input 
                  type="text"
                  placeholder="Enter your last name"
                  value={formData.lastName}
                  onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                  className="w-full bg-white border border-gray-100 px-5 py-3.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ruby/10 focus:border-ruby transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Email Address</label>
              <input 
                type="email"
                placeholder="Enter your email address"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full bg-white border border-gray-100 px-5 py-3.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ruby/10 focus:border-ruby transition-all"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Phone Number</label>
              <input 
                type="tel"
                placeholder="Enter your phone number"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full bg-white border border-gray-100 px-5 py-3.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ruby/10 focus:border-ruby transition-all"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Password</label>
              <input 
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full bg-white border border-gray-100 px-5 py-3.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ruby/10 focus:border-ruby transition-all"
                required
              />
            </div>

            <div className="flex items-start gap-3 py-2">
              <input 
                type="checkbox" 
                id="terms"
                checked={formData.agreeTerms}
                onChange={(e) => setFormData({...formData, agreeTerms: e.target.checked})}
                className="mt-1 w-4 h-4 rounded border-gray-300 text-ruby focus:ring-ruby"
              />
              <label htmlFor="terms" className="text-xs text-gray-400 leading-relaxed">
                I agree to the <Link to="/terms" className="text-ruby font-bold hover:underline">Terms & Conditions</Link> and <Link to="/privacy" className="text-ruby font-bold hover:underline">Privacy Policy</Link>
              </label>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-[#1A2C54] text-white py-4 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-ruby transition-all shadow-xl shadow-[#1A2C54]/10 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? "Creating Account..." : (
                <>
                  Create Account
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="relative flex items-center gap-4 py-2">
            <div className="flex-grow border-t border-gray-100"></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">or sign up with</span>
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

          <p className="text-center text-sm text-gray-400">
            Already have an account? <Link to="/login" className="text-ruby font-bold hover:underline ml-1">Sign In</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
