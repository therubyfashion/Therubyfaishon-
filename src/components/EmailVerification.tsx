import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, ShieldCheck, X, ArrowRight, RefreshCw, CheckCircle2, ArrowLeft } from 'lucide-react';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

interface EmailVerificationProps {
  onSuccess?: () => void;
  onClose?: () => void;
  email: string;
  userId: string;
}

export default function EmailVerification({ onSuccess, onClose, email, userId }: EmailVerificationProps) {
  const [step, setStep] = useState<'info' | 'otp'>('info');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const [generatedOtp, setGeneratedOtp] = useState('');

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleSendOtp = async () => {
    setLoading(true);
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(code);

      // Save OTP to user's doc (transiently)
      await updateDoc(doc(db, 'users', userId), {
        addressConfirmOtp: code,
        addressConfirmOtpCreatedAt: new Date().toISOString()
      });

      // Send Email
      const emailHtml = `
        <div style="font-family: sans-serif; padding: 40px; color: #1A2C54; background-color: #F8FAFC;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
            <h1 style="color: #E11D48; margin-bottom: 24px;">Confirm Your Address</h1>
            <p style="font-size: 16px; line-height: 1.6; color: #64748B;">Please use the following verification code to confirm your delivery address and complete your order.</p>
            
            <div style="background: #F1F5F9; padding: 30px; border-radius: 16px; text-align: center; margin: 30px 0;">
              <span style="font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #1A2C54;">${code}</span>
            </div>
            
            <p style="font-size: 14px; color: #94A3B8; text-align: center;">This code is valid for 10 minutes.</p>
            
            <div style="margin-top: 40px; border-top: 1px solid #F1F5F9; padding-top: 20px; text-align: center;">
              <p style="font-size: 12px; color: #94A3B8;">&copy; ${new Date().getFullYear()} The Ruby Fashion</p>
            </div>
          </div>
        </div>
      `;

      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: `${code} is your address confirmation code`,
          html: emailHtml
        })
      });

      toast.success("OTP sent to your Gmail! ✨");
      setStep('otp');
      setTimer(60);
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      toast.error("Failed to send verification code.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-send OTP on mount if in info step
  useEffect(() => {
    if (step === 'info') {
      handleSendOtp();
    }
  }, []);

  const handleOtpChange = (index: number, value: string) => {
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      document.getElementById(`email-otp-${index + 1}`)?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const enteredOtp = otp.join('');
    if (enteredOtp.length < 6) {
      toast.error("Please enter the full 6-digit OTP");
      return;
    }

    setLoading(true);
    try {
      const userSnap = await getDoc(doc(db, 'users', userId));
      const userData = userSnap.data();

      if (userData?.addressConfirmOtp === enteredOtp) {
        // Mark as verified for this session/action
        await updateDoc(doc(db, 'users', userId), {
          phoneVerified: true, // Re-using this flag as requested or setting a custom one
          addressConfirmedAt: new Date().toISOString(),
          addressConfirmOtp: null // Clear after use
        });

        toast.success("Address confirmed successfully! 🎉");
        if (onSuccess) onSuccess();
        if (onClose) onClose();
      } else {
        toast.error("Invalid verification code.");
      }
    } catch (error) {
      console.error("Verification error:", error);
      toast.error("Failed to verify code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden relative"
      >
        {/* Header */}
        <div className="p-8 pb-4 flex justify-between items-start">
          <div className="flex gap-4">
            <div className="w-12 h-12 bg-ruby/10 rounded-2xl flex items-center justify-center text-ruby">
              {step === 'info' ? <Mail size={24} /> : <ShieldCheck size={24} />}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-8 pb-8 space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-serif font-bold text-[#1A2C54]">
              {step === 'info' ? 'Confirm Address' : 'Check your Email'}
            </h2>
            <p className="text-sm text-gray-400 font-medium leading-relaxed">
              {step === 'info' 
                ? `We're sending a verification code to your registered email ${email} to secure your address.`
                : `We've sent a 6-digit code to ${email}. Please enter it to confirm your address.`}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {step === 'info' ? (
              <motion.div 
                key="info"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center justify-center py-8"
              >
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                  <RefreshCw className="animate-spin text-ruby" size={24} />
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sending Code...</p>
              </motion.div>
            ) : (
              <motion.div 
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-6 gap-2 sm:gap-3">
                  {otp.map((digit, idx) => (
                    <input 
                      key={idx}
                      id={`email-otp-${idx}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !digit && idx > 0) {
                          document.getElementById(`email-otp-${idx - 1}`)?.focus();
                        } else if (e.key === 'Enter' && otp.join('').length === 6) {
                          handleVerifyOtp();
                        }
                      }}
                      className="w-full aspect-square bg-gray-50 border border-gray-100 rounded-xl text-center text-xl font-black text-[#1A2C54] focus:outline-none focus:ring-2 focus:ring-ruby/20 focus:border-ruby transition-all"
                    />
                  ))}
                </div>

                <div className="flex flex-col gap-4">
                  <button 
                    onClick={handleVerifyOtp}
                    disabled={loading || otp.join('').length < 6}
                    className="w-full bg-ruby text-white py-4 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-[#1A2C54] transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-xl shadow-ruby/20"
                  >
                    {loading ? <RefreshCw className="animate-spin" size={18} /> : (
                      <>
                        Verify & Confirm Address
                        <CheckCircle2 size={18} />
                      </>
                    )}
                  </button>
                  
                  <div className="text-center">
                    {timer > 0 ? (
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Resend code in <span className="text-ruby">{timer}s</span>
                      </p>
                    ) : (
                      <button 
                        onClick={handleSendOtp}
                        className="text-xs font-bold text-ruby uppercase tracking-widest hover:underline"
                      >
                        Resend OTP Code
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-6 flex items-center justify-center gap-2">
          <ShieldCheck size={14} className="text-green-500" />
          <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">
            Secure Email Verification Activated
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
