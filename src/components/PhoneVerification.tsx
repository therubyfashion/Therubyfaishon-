import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, ShieldCheck, X, ArrowRight, RefreshCw, CheckCircle2, ArrowLeft } from 'lucide-react';
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult, linkWithPhoneNumber } from 'firebase/auth';
import { auth, db } from '../firebase';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

interface PhoneVerificationProps {
  onSuccess?: (phoneNumber: string) => void;
  onClose?: () => void;
  prefillPhone?: string;
}

declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier | undefined;
  }
}

export default function PhoneVerification({ onSuccess, onClose, prefillPhone }: PhoneVerificationProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [phoneNumber, setPhoneNumber] = useState(prefillPhone || '');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'input' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [step]);

  // Auto-trigger send OTP if prefilled and valid
  useEffect(() => {
    if (prefillPhone && prefillPhone.length === 10 && step === 'input' && !confirmationResult && !loading) {
      // We can't auto-trigger easily because of reCAPTCHA, but we can highlight the button
    }
  }, [prefillPhone]);

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  useEffect(() => {
    // Initialize reCAPTCHA on mount
    const initRecaptcha = () => {
      if (!verifierRef.current && recaptchaRef.current) {
        try {
          // Clear any existing content in the container to avoid "already rendered" error
          if (recaptchaRef.current) {
            recaptchaRef.current.innerHTML = '';
          }

          verifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'invisible',
            'callback': () => {
              console.log('reCAPTCHA solved');
            },
            'expired-callback': () => {
              console.log('reCAPTCHA expired');
              if (verifierRef.current) {
                verifierRef.current.clear();
                verifierRef.current = null;
                initRecaptcha(); // Re-init on expiry
              }
            }
          });
        } catch (error) {
          console.error("reCAPTCHA Init Error:", error);
        }
      }
    };

    initRecaptcha();

    return () => {
      if (verifierRef.current) {
        try {
          verifierRef.current.clear();
        } catch (e) {
          console.error("Cleanup error:", e);
        }
        verifierRef.current = null;
      }
    };
  }, []);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Clean phone number
    let cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
      cleanPhone = cleanPhone.slice(2);
    }
    
    if (cleanPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    const fullPhone = `+91${cleanPhone}`;

    setLoading(true);
    try {
      if (!verifierRef.current) {
        throw new Error("reCAPTCHA not initialized. Please refresh.");
      }

      const confirmation = await signInWithPhoneNumber(auth, fullPhone, verifierRef.current);
      setConfirmationResult(confirmation);

      toast.success(`OTP sent to ${fullPhone}! 📲`);
      setStep('otp');
      setTimer(60);
    } catch (error: any) {
      console.error("Firebase Phone Auth Error:", error);
      let msg = "Failed to send OTP. Please try again.";
      if (error.code === 'auth/too-many-requests') {
        msg = "Too many requests. Please try again later.";
      } else if (error.code === 'auth/invalid-phone-number') {
        msg = "Invalid phone number format.";
      } else if (error.code === 'auth/captcha-check-failed') {
        msg = "reCAPTCHA verification failed. Please try again.";
      }
      toast.error(msg);
      
      // Reset reCAPTCHA on error
      if (verifierRef.current) {
        verifierRef.current.clear();
        verifierRef.current = null;
        // Re-init will happen on next attempt or we can call it here
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').slice(0, 6).split('');
    const newOtp = [...otp];
    pasteData.forEach((char, i) => {
      if (i < 6) newOtp[i] = char;
    });
    setOtp(newOtp);
    document.getElementById(`otp-${Math.min(pasteData.length, 5)}`)?.focus();
  };

  const handleVerifyOtp = async () => {
    const enteredOtp = otp.join('');
    if (enteredOtp.length < 6) {
      toast.error("Please enter the full 6-digit OTP");
      return;
    }

    if (!confirmationResult) {
      toast.error("No active verification found. Please resend OTP.");
      setStep('input');
      return;
    }

    setLoading(true);
    try {
      const result = await confirmationResult.confirm(enteredOtp);
      const firebaseUser = result.user;

      // Check if user profile exists, if not create it
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', firebaseUser.uid), {
          uid: firebaseUser.uid,
          phoneNumber: firebaseUser.phoneNumber,
          role: 'client',
          createdAt: new Date().toISOString(),
          isVerified: true
        });
      }
      
      toast.success("Logged in successfully! 🎉");
      if (onSuccess) onSuccess(firebaseUser.phoneNumber || '');
      if (onClose) onClose();
      
      // No need for reload, AuthContext will pick up the change
    } catch (error: any) {
      console.error("Verification error:", error);
      let msg = "Invalid OTP code. Please try again.";
      if (error.code === 'auth/code-expired') {
        msg = "OTP code has expired. Please resend.";
      }
      toast.error(msg);
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
            {step === 'otp' && (
              <button 
                onClick={() => setStep('input')}
                className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 transition-colors"
                title="Back to phone number"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div className="w-12 h-12 bg-ruby/10 rounded-2xl flex items-center justify-center text-ruby">
              {step === 'input' ? <Phone size={24} /> : <ShieldCheck size={24} />}
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
          <div id="recaptcha-container" ref={recaptchaRef}></div>
          <div className="space-y-2">
            <h2 className="text-2xl font-serif font-bold text-[#1A2C54]">
              {step === 'input' ? 'Verify your Phone' : 'Enter OTP Code'}
            </h2>
            <p className="text-sm text-gray-400 font-medium leading-relaxed">
              {step === 'input' 
                ? "We'll send a 6-digit code to verify your identity and ensure secure delivery."
                : `We've sent a verification code to ${phoneNumber}. Please enter it below.`}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {step === 'input' ? (
              <motion.form 
                key="input"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleSendOtp}
                className="space-y-4"
              >
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-ruby transition-colors">
                    <span className="text-sm font-bold">+91</span>
                  </div>
                  <input 
                    ref={inputRef}
                    type="tel"
                    placeholder="Phone Number"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="w-full pl-14 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-[#1A2C54] focus:outline-none focus:ring-2 focus:ring-ruby/20 focus:border-ruby transition-all"
                    required
                  />
                </div>
                <button 
                  type="submit"
                  disabled={loading || phoneNumber.length < 10}
                  className="w-full bg-[#1A2C54] text-white py-4 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-ruby transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-[#1A2C54]/10"
                >
                  {loading ? <RefreshCw className="animate-spin" size={18} /> : (
                    <>
                      Send OTP Code
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </motion.form>
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
                      id={`otp-${idx}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onPaste={handlePaste}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !digit && idx > 0) {
                          document.getElementById(`otp-${idx - 1}`)?.focus();
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
                        Verify & Continue
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

                <button 
                  onClick={() => setStep('input')}
                  className="w-full text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-[#1A2C54] transition-colors"
                >
                  Change Phone Number
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-6 flex items-center justify-center gap-2">
          <ShieldCheck size={14} className="text-green-500" />
          <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">
            Secure 256-bit Encrypted Verification
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
