import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { Mail, ArrowRight, RefreshCw, LogOut, Sparkles } from 'lucide-react';

export default function VerifyPrompt() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [storeSettings, setStoreSettings] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [uid, setUid] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const emailParam = params.get('email');
    const uidParam = params.get('uid');
    
    if (emailParam) setEmail(emailParam);
    if (uidParam) setUid(uidParam);

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
  }, [location]);

  const handleResendVerification = async () => {
    if (!email || !uid) {
      toast.error("Missing user information. Please try signing up again.");
      return;
    }

    setLoading(true);
    try {
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        toast.error("User not found.");
        return;
      }

      const userData = userDoc.data();
      const verificationToken = userData.verificationToken || Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      if (!userData.verificationToken) {
        await updateDoc(userDocRef, { verificationToken });
      }

      const verificationLink = `${window.location.origin}/verify-email?uid=${uid}&token=${verificationToken}`;

      const emailHtml = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #FAFAFA; padding: 40px 20px; color: #1A2C54;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 40px; padding: 60px; box-shadow: 0 20px 50px -20px rgba(0,0,0,0.08); border: 1px solid #F0F0F0;">
            <div style="text-align: center; margin-bottom: 50px;">
              ${storeSettings?.storeLogo ? `<img src="${storeSettings.storeLogo}" alt="${storeSettings.storeName}" style="max-height: 60px; margin-bottom: 10px;">` : `<h1 style="font-size: 32px; font-weight: bold; letter-spacing: -1px; margin: 0; color: #E11D48;">${storeSettings?.storeName?.toUpperCase() || 'THE RUBY'}</h1>`}
            </div>
            
            <div style="text-align: center; margin-bottom: 40px;">
              <div style="display: inline-block; background-color: #FDF2F8; color: #E11D48; padding: 12px 24px; border-radius: 100px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 24px;">Verification Required</div>
              <h2 style="font-size: 28px; font-weight: bold; margin: 0 0 16px 0; color: #1A2C54;">Verify Your Email ✨</h2>
              <p style="font-size: 16px; color: #666666; line-height: 1.6; margin: 0;">You requested a new verification link. Please click the button below to verify your account and start shopping.</p>
            </div>

            <div style="text-align: center; margin-bottom: 50px;">
              <a href="${verificationLink}" style="display: inline-block; background-color: #1A2C54; color: #FFFFFF; padding: 20px 40px; border-radius: 16px; text-decoration: none; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; box-shadow: 0 10px 20px -5px rgba(26,44,84,0.3);">Verify My Account</a>
            </div>

            <div style="background-color: #F9FAFB; border-radius: 24px; padding: 32px; margin-bottom: 40px; border: 1px solid #F3F4F6; text-align: center;">
              <p style="font-size: 14px; color: #666666; margin: 0;">If the button doesn't work, you can also copy and paste this link into your browser:</p>
              <p style="font-size: 12px; color: #9CA3AF; margin: 12px 0 0 0; word-break: break-all;">${verificationLink}</p>
            </div>

            <div style="text-align: center; border-top: 1px solid #F0F0F0; pt-40px;">
              <p style="font-size: 16px; font-weight: bold; color: #1A2C54; margin: 0;">Happy Shopping!</p>
              <p style="font-size: 14px; color: #E11D48; font-weight: bold; margin: 4px 0 0 0;">Team ${storeSettings?.storeName || 'The Ruby'}</p>
            </div>
          </div>
        </div>
      `;

      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: 'Verify Your Email - The Ruby ✨',
          html: emailHtml
        })
      });

      toast.success("Verification email resent! Please check your inbox.");
    } catch (error: any) {
      console.error("Resend error:", error);
      toast.error("Failed to resend verification email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#FAFAFA] py-12 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-ruby/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-ruby/5 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-8 md:p-12 rounded-[2.5rem] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.08)] border border-gray-50 relative z-10 text-center"
      >
        <div className="mb-8">
          <div className="w-20 h-20 bg-ruby/10 text-ruby rounded-3xl flex items-center justify-center mx-auto">
            <Mail size={40} />
          </div>
        </div>

        <div className="space-y-4 mb-10">
          <h1 className="text-3xl font-serif font-bold tracking-tight text-[#1A2C54]">
            Verify Your <span className="text-ruby italic">Email</span>
          </h1>
          <p className="text-sm text-gray-400 font-medium leading-relaxed">
            We've sent a verification link to <span className="text-[#1A2C54] font-bold">{email}</span>. 
            Please check your inbox and click the link to activate your account.
          </p>
        </div>

        <div className="space-y-4">
          <button 
            onClick={handleResendVerification}
            disabled={loading}
            className="w-full bg-[#1A2C54] text-white py-5 rounded-2xl text-sm font-bold uppercase tracking-[0.2em] hover:bg-ruby transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-[#1A2C54]/10 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <>
                Resend Email
                <RefreshCw size={18} />
              </>
            )}
          </button>

          <Link 
            to="/login"
            className="w-full bg-white border border-gray-100 text-[#1A2C54] py-5 rounded-2xl text-sm font-bold uppercase tracking-[0.2em] hover:bg-gray-50 transition-all flex items-center justify-center gap-3"
          >
            Back to Login
            <LogOut size={18} />
          </Link>
        </div>

        <div className="pt-8">
          <p className="text-[10px] text-gray-300 uppercase tracking-[0.3em] font-bold flex items-center justify-center gap-2">
            <Sparkles size={12} className="text-ruby" />
            The Ruby Premium Experience
          </p>
        </div>
      </motion.div>
    </div>
  );
}
