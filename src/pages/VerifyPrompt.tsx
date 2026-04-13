import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { Mail, ArrowRight, RefreshCw, LogOut, Sparkles, CheckCircle2 } from 'lucide-react';

export default function VerifyPrompt() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [storeSettings, setStoreSettings] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [uid, setUid] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);

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

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      toast.error("Please enter the full 6-digit code.");
      return;
    }

    setVerifying(true);
    try {
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        toast.error("User not found.");
        return;
      }

      const userData = userDoc.data();
      if (userData.emailOtp === otpValue) {
        await updateDoc(userDocRef, {
          isVerified: true,
          emailOtp: null
        });

        // Send Welcome Email
        const welcomeHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to The Ruby</title>
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
                        ${storeSettings?.storeLogo ? 
                          `<img src="${storeSettings.storeLogo}" alt="${storeSettings.storeName}" style="max-height: 60px; display: block;">` : 
                          `<h1 style="margin: 0; color: #1A2C54; font-size: 32px; font-weight: 800; letter-spacing: -1.5px; text-transform: uppercase;">THE <span style="color: #E11D48; font-style: italic;">RUBY</span></h1>`
                        }
                      </td>
                    </tr>
                    
                    <!-- Hero Section -->
                    <tr>
                      <td style="padding: 20px 60px 40px 60px; text-align: center;">
                        <div style="font-size: 50px; margin-bottom: 20px;">🎉</div>
                        <h2 style="margin: 0 0 16px 0; color: #1A2C54; font-size: 28px; font-weight: 700; line-height: 1.2;">You're In, ${userData.firstName || 'Gorgeous'}!</h2>
                        <p style="margin: 0; color: #64748B; font-size: 16px; line-height: 1.6;">Your account is now verified. Get ready to explore the most curated fashion collections designed just for you.</p>
                      </td>
                    </tr>

                    <!-- Action Button -->
                    <tr>
                      <td align="center" style="padding: 0 60px 50px 60px;">
                        <a href="${window.location.origin}" style="display: inline-block; background-color: #1A2C54; color: #ffffff; padding: 20px 45px; border-radius: 18px; text-decoration: none; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; box-shadow: 0 10px 25px rgba(26,44,84,0.2);">Start Shopping Now</a>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="padding: 50px 60px; background-color: #1A2C54; text-align: center;">
                        <p style="margin: 0; color: #ffffff; font-size: 14px; font-weight: 600;">Welcome to the Family!</p>
                        <p style="margin: 10px 0 0 0; color: #FB7185; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Team ${storeSettings?.storeName || 'The Ruby Fashion'}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;

        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: userData.email,
            subject: `Welcome to the Family, ${userData.firstName || ''}! ✨`,
            html: welcomeHtml
          })
        });

        toast.success("Email verified successfully! Welcome email sent.");
        navigate('/login');
      } else {
        toast.error("Invalid verification code. Please try again.");
      }
    } catch (error: any) {
      console.error("Verification error:", error);
      toast.error("Failed to verify code.");
    } finally {
      setVerifying(false);
    }
  };

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
      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      
      await updateDoc(userDocRef, { emailOtp: newOtp });

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your Verification Code</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.05);">
                  <!-- Header -->
                  <tr>
                    <td align="center" style="padding: 40px 40px 20px 40px;">
                      ${storeSettings?.storeLogo ? 
                        `<img src="${storeSettings.storeLogo}" alt="${storeSettings.storeName}" style="max-height: 50px; display: block;">` : 
                        `<h1 style="margin: 0; color: #E11D48; font-size: 28px; font-weight: 800; letter-spacing: -1px; text-transform: uppercase;">${storeSettings?.storeName || 'THE RUBY'}</h1>`
                      }
                    </td>
                  </tr>
                  
                  <!-- Hero Icon -->
                  <tr>
                    <td align="center" style="padding: 20px 40px;">
                      <div style="width: 80px; height: 80px; background-color: #FFF1F2; border-radius: 24px; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
                        <span style="font-size: 40px; line-height: 80px;">🔐</span>
                      </div>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 20px 60px 40px 60px; text-align: center;">
                      <h2 style="margin: 0 0 16px 0; color: #1A2C54; font-size: 24px; font-weight: 700; line-height: 1.2;">New Verification Code</h2>
                      <p style="margin: 0; color: #64748B; font-size: 16px; line-height: 1.6;">You requested a new code. Use the code below to verify your email address.</p>
                    </td>
                  </tr>

                  <!-- OTP Box -->
                  <tr>
                    <td align="center" style="padding: 0 60px 40px 60px;">
                      <div style="background-color: #F8FAFC; border-radius: 16px; padding: 30px; border: 2px solid #F1F5F9; display: inline-block;">
                        <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #1A2C54; font-family: 'Courier New', Courier, monospace;">${newOtp}</span>
                      </div>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 40px 60px; background-color: #1A2C54; text-align: center;">
                      <p style="margin: 0 0 8px 0; color: #ffffff; font-size: 14px; font-weight: 600;">This code will expire in 10 minutes.</p>
                      <p style="margin: 0; color: #FB7185; font-size: 12px; font-weight: 700;">Team ${storeSettings?.storeName || 'The Ruby'}</p>
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
          to: email,
          subject: `${newOtp} is your new verification code ✨`,
          html: emailHtml
        })
      });

      const emailData = await emailResponse.json();
      if (!emailResponse.ok) {
        throw new Error(emailData.error || "Failed to resend code");
      }

      toast.success("New verification code sent!");
    } catch (error: any) {
      console.error("Resend error:", error);
      toast.error("Failed to resend code.");
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
            We've sent a 6-digit code to <span className="text-[#1A2C54] font-bold">{email}</span>. 
            Enter it below to activate your account.
          </p>
        </div>

        {/* OTP Input Group */}
        <div className="flex justify-center gap-2 mb-10">
          {otp.map((digit, index) => (
            <input
              key={index}
              id={`otp-${index}`}
              type="text"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-12 h-14 text-center text-xl font-bold bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-ruby/20 focus:border-ruby transition-all"
            />
          ))}
        </div>

        <div className="space-y-4">
          <button 
            onClick={handleVerifyOtp}
            disabled={verifying}
            className="w-full bg-[#1A2C54] text-white py-5 rounded-2xl text-sm font-bold uppercase tracking-[0.2em] hover:bg-ruby transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-[#1A2C54]/10 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {verifying ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <>
                Verify Code
                <CheckCircle2 size={18} />
              </>
            )}
          </button>

          <button 
            onClick={handleResendVerification}
            disabled={loading}
            className="w-full bg-white border border-gray-100 text-[#1A2C54] py-5 rounded-2xl text-sm font-bold uppercase tracking-[0.2em] hover:bg-gray-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <>
                Resend Code
                <RefreshCw size={18} />
              </>
            )}
          </button>
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
