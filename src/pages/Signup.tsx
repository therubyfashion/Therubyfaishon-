import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  createUserWithEmailAndPassword, 
  updateProfile, 
  signOut,
  setPersistence,
  browserLocalPersistence 
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
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

    const handleRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          const user = result.user;
          await finishSignup(user);
          return;
        } 
        
        if (auth.currentUser) {
          await finishSignup(auth.currentUser);
          return;
        }
      } catch (error: any) {
        console.error("Signup Redirect Error:", error.code);
        if (auth.currentUser) {
          await finishSignup(auth.currentUser);
        }
      } finally {
        setLoading(false);
      }
    };

    const finishSignup = async (user: any) => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            role: 'user',
            isVerified: true,
            createdAt: new Date().toISOString()
          });
        }
        toast.success("Account created successfully! 🎉");
        navigate('/');
      } catch (err) {
        console.error("Finish signup error:", err);
      } finally {
        setLoading(false);
      }
    };

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && !loading) {
        finishSignup(user);
      }
    });

    const timer = setTimeout(handleRedirect, 1000);
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [navigate, loading]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ 
        prompt: 'select_account',
        display: 'touch',
        ux_mode: 'redirect'
      });
      
      await setPersistence(auth, browserLocalPersistence);

      const isWebView = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || 
                       (window as any).navigator.standalone || 
                       window.matchMedia('(display-mode: standalone)').matches;

      provider.setCustomParameters({ 
        prompt: 'select_account',
        display: 'touch',
        ux_mode: 'redirect'
      });

      if (isWebView) {
        console.log("🚀 App Detected: Forcing Redirect Mode for Signup...");
        await signInWithRedirect(auth, provider);
      } else {
        try {
          const { user } = await signInWithPopup(auth, provider);
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (!userDoc.exists()) {
            await setDoc(doc(db, 'users', user.uid), {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              role: 'user',
              isVerified: true,
              createdAt: new Date().toISOString()
            });
          }
          toast.success("successfully account created 🎉", { position: 'bottom-center', duration: 5000 });
          navigate('/');
        } catch (popupError: any) {
          if (popupError.code === 'auth/popup-blocked' || 
              popupError.code === 'auth/operation-not-supported-in-this-environment') {
            await signInWithRedirect(auth, provider);
          } else {
            throw popupError;
          }
        }
      }
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        // No toast needed for this one
        return;
      }
      if (error.code === 'auth/account-exists-with-different-credential') {
        toast.error("Aapka account pehle se bana hai kisi aur method se. Please wahi use karein.");
      } else {
        toast.error("Account nahi ban paaya. Dobara try karein.");
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
      // Parallelize settings fetch and user creation
      const settingsPromise = storeSettings ? Promise.resolve(storeSettings) : 
        getDocs(collection(db, 'settings')).then(snap => snap.empty ? null : snap.docs[0].data());
      
      const authPromise = createUserWithEmailAndPassword(auth, formData.email, formData.password);
      
      const [currentSettings, { user }] = await Promise.all([settingsPromise, authPromise]);
      
      const fullName = `${formData.firstName} ${formData.lastName}`;
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Parallelize profile updates
      await Promise.all([
        updateProfile(user, { displayName: fullName }),
        setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: formData.email,
          displayName: fullName,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phoneNumber: formData.phone,
          role: 'user',
          isVerified: false,
          phoneVerified: false,
          emailOtp: otp,
          createdAt: new Date().toISOString()
        })
      ]);

      // Send Verification Email with OTP
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Account</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap" rel="stylesheet">
        </head>
        <body style="margin: 0; padding: 0; background-color: #FAFAFA; font-family: 'Inter', sans-serif;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
            <tr>
              <td align="center" style="padding: 60px 0;">
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 32px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.05); border: 1px solid #F1F5F9;">
                  <!-- Brand Header -->
                  <tr>
                    <td align="center" style="padding: 50px 40px 30px 40px; background: linear-gradient(to bottom, #FFF1F2 0%, #ffffff 100%);">
                      ${currentSettings?.storeLogo ? 
                        `<img src="${currentSettings.storeLogo}" alt="${currentSettings.storeName}" style="max-height: 60px; display: block;">` : 
                        `<h1 style="margin: 0; color: #1A2C54; font-size: 32px; font-weight: 800; letter-spacing: -1.5px; text-transform: uppercase;">THE <span style="color: #E11D48; font-style: italic;">RUBY</span></h1>`
                      }
                    </td>
                  </tr>
                  
                  <!-- Content Section -->
                  <tr>
                    <td style="padding: 20px 60px 40px 60px; text-align: center;">
                      <div style="display: inline-block; padding: 12px 24px; background-color: #FFF1F2; border-radius: 100px; margin-bottom: 24px;">
                        <span style="color: #E11D48; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px;">Security Verification</span>
                      </div>
                      <h2 style="margin: 0 0 16px 0; color: #1A2C54; font-size: 28px; font-weight: 700; line-height: 1.2;">Welcome, ${formData.firstName}!</h2>
                      <p style="margin: 0; color: #64748B; font-size: 16px; line-height: 1.6;">To ensure your account's security and provide you with a premium shopping experience, please use the verification code below.</p>
                    </td>
                  </tr>

                  <!-- OTP Display -->
                  <tr>
                    <td align="center" style="padding: 0 60px 50px 60px;">
                      <div style="background-color: #F8FAFC; border-radius: 24px; padding: 40px; border: 2px solid #F1F5F9; display: inline-block; min-width: 240px;">
                        <span style="font-size: 48px; font-weight: 800; letter-spacing: 16px; color: #1A2C54; font-family: 'Courier New', Courier, monospace; margin-right: -16px;">${otp}</span>
                      </div>
                      <p style="margin: 24px 0 0 0; color: #94A3B8; font-size: 13px; font-weight: 500;">This code is valid for the next 10 minutes.</p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 50px 60px; background-color: #1A2C54; text-align: center;">
                      <div style="margin-bottom: 24px;">
                        <span style="color: #ffffff; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 3px;">${currentSettings?.storeName || 'The Ruby'} Premium</span>
                      </div>
                      <p style="margin: 0; color: #94A3B8; font-size: 12px; line-height: 1.6;">If you didn't request this code, please ignore this email or contact our support team.</p>
                      <div style="margin-top: 30px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 30px;">
                        <p style="margin: 0; color: #FB7185; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">&copy; ${new Date().getFullYear()} ${currentSettings?.storeName || 'The Ruby Fashion'}</p>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      const emailResponse = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: formData.email,
          fromName: currentSettings?.storeName || 'The Ruby',
          subject: `${otp} is your verification code ✨`,
          html: emailHtml
        })
      });

      const emailData = await emailResponse.json();
      if (!emailResponse.ok) {
        console.error("Email send failed:", emailData.error);
        if (emailData.error?.includes("Bhai")) {
          toast.error(emailData.error, { duration: 6000 });
        } else {
          toast.error("Account created, but verification email failed to send. Resend it from the next screen.");
        }
      } else {
        toast.success("Verification code sent to your email!");
      }

      localStorage.removeItem('phone_user');
      // Keep user signed in so they have permissions to update their profile during verification
      const errorParam = !emailResponse.ok ? `&message=${encodeURIComponent("Account created, but verification email failed to send. You can resend it from the next screen.")}` : '';
      navigate(`/verify-prompt?email=${encodeURIComponent(formData.email)}&uid=${user.uid}${errorParam}`);
    } catch (error: any) {
      console.error("Signup error:", error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error("Email already in use. Please sign in.");
      } else if (error.code === 'auth/network-request-failed') {
        toast.error("Network error! Please check your internet connection or disable ad-blockers.");
      } else if (error.code === 'not-found' || error.message?.includes('5 NOT_FOUND')) {
        toast.error("Bhai, Database abhi ready ho raha hai (Google Provisioning). 2-3 minute baad dobara try karein, sab thik ho jayega! 💎", { duration: 6000 });
      } else if (error.message) {
        toast.error(error.message);
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
