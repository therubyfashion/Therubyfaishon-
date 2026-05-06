import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, ArrowRight, ChevronLeft, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { sendNotification } from '../lib/notifications';

export default function LoginPhone() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOTP] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number.");
      return;
    }
    setLoading(true);
    // Simulate OTP sending
    await new Promise(resolve => setTimeout(resolve, 1500));
    setStep('otp');
    setLoading(false);
    toast.success("OTP sent to your number! (Use 123456)");
  };

  const handleOTPChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOTP = [...otp];
    newOTP[index] = value;
    setOTP(newOTP);
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const code = otp.join('');
      // Simulation for demo / quick implementation
      if (code === '123456' || code === '888888') {
        // In a real app, you'd use Firebase Phone Auth's confirmation object
        // Here we simulate successful login
        toast.success("Logged in successfully with Phone!");
        navigate('/');
      } else {
        toast.error("Invalid OTP. Try 123456");
      }
    } catch (err) {
      toast.error("Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8"
      >
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/login')} className="p-2 -ml-2 hover:bg-gray-50 rounded-xl transition-all">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-3xl font-serif font-bold text-[#1A2C54]">Phone <span className="text-ruby italic">Login</span></h1>
        </div>

        <AnimatePresence mode="wait">
          {step === 'phone' ? (
            <motion.form 
              key="phone"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleSendOTP} 
              className="space-y-6"
            >
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Phone Number</label>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-ruby transition-colors">
                    <Smartphone size={18} />
                  </div>
                  <div className="absolute left-12 top-1/2 -translate-y-1/2 text-gray-800 font-bold text-sm">+91</div>
                  <input 
                    type="tel" 
                    placeholder="Enter 10 digit number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 px-24 py-4 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-ruby/10 focus:border-ruby transition-all"
                    required
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-shop-text text-white py-4 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-ruby transition-all shadow-xl shadow-ruby/10 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Verification OTP"}
                <ArrowRight size={18} />
              </button>
            </motion.form>
          ) : (
            <motion.form 
              key="otp"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleVerifyOTP} 
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-ruby/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Lock className="text-ruby" size={32} />
                </div>
                <h3 className="text-xl font-bold text-[#1A2C54]">Enter Code</h3>
                <p className="text-gray-400 text-sm">We've sent a 6-digit code to <b>+91 {phone}</b></p>
              </div>

              <div className="flex justify-between gap-2">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`otp-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOTPChange(idx, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
                        document.getElementById(`otp-${idx - 1}`)?.focus();
                      }
                    }}
                    className="w-12 h-14 bg-gray-50 border-none rounded-xl text-center text-xl font-bold text-[#1A2C54] focus:ring-2 focus:ring-ruby"
                  />
                ))}
              </div>

              <div className="space-y-4">
                <button 
                  type="submit"
                  disabled={loading || otp.join('').length < 6}
                  className="w-full bg-[#1A2C54] text-white py-4 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-ruby transition-all shadow-xl shadow-ruby/10 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? "Verifying..." : "Verify & Continue"}
                </button>
                <button 
                  type="button"
                  onClick={() => setStep('phone')}
                  className="w-full text-gray-400 text-[10px] font-bold uppercase tracking-widest hover:text-ruby transition-colors"
                >
                  Change Number
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <p className="text-center text-sm text-gray-400">
          Prefer using email? <Link to="/login" className="text-ruby font-bold hover:underline ml-1">Login with Password</Link>
        </p>
      </motion.div>
    </div>
  );
}
