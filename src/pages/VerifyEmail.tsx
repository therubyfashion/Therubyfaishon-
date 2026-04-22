import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { CheckCircle2, XCircle, Loader2, ArrowRight, Sparkles } from 'lucide-react';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email...');

  const uid = searchParams.get('uid');
  const token = searchParams.get('token');

  useEffect(() => {
    const verify = async () => {
      if (!uid || !token) {
        setStatus('error');
        setMessage('Invalid verification link.');
        return;
      }

      try {
        const userDocRef = doc(db, 'users', uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
          setStatus('error');
          setMessage('User not found.');
          return;
        }

        const userData = userDoc.data();
        if (userData.isVerified) {
          setStatus('success');
          setMessage('Email already verified!');
          return;
        }

        if (userData.verificationToken === token) {
          await updateDoc(userDocRef, {
            isVerified: true,
            verificationToken: null // Clear the token after use
          });
          setStatus('success');
          setMessage('Your email has been successfully verified!');
          toast.success("successfully account created 🎉", { position: 'bottom-center', duration: 5000 });
        } else {
          setStatus('error');
          setMessage('Invalid or expired verification token.');
        }
      } catch (error: any) {
        console.error("Verification error:", error);
        setStatus('error');
        if (error.code === 'auth/account-exists-with-different-credential') {
          setMessage('You already have an account with this email using a different login method (e.g., Google or Email). Please use your original method to sign in.');
        } else {
          setMessage('An error occurred during verification.');
        }
      }
    };

    verify();
  }, [uid, token]);

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
          {status === 'loading' && (
            <div className="w-20 h-20 bg-ruby/10 text-ruby rounded-3xl flex items-center justify-center mx-auto animate-pulse">
              <Loader2 size={40} className="animate-spin" />
            </div>
          )}
          {status === 'success' && (
            <div className="w-20 h-20 bg-green-50 text-green-500 rounded-3xl flex items-center justify-center mx-auto">
              <CheckCircle2 size={40} />
            </div>
          )}
          {status === 'error' && (
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto">
              <XCircle size={40} />
            </div>
          )}
        </div>

        <div className="space-y-4 mb-10">
          <h1 className="text-3xl font-serif font-bold tracking-tight text-[#1A2C54]">
            Email <span className="text-ruby italic">Verification</span>
          </h1>
          <p className="text-sm text-gray-400 font-medium leading-relaxed">
            {message}
          </p>
        </div>

        {status !== 'loading' && (
          <Link 
            to="/login"
            className="w-full bg-[#1A2C54] text-white py-5 rounded-2xl text-sm font-bold uppercase tracking-[0.2em] hover:bg-ruby transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-[#1A2C54]/10 flex items-center justify-center gap-3"
          >
            Go to Login
            <ArrowRight size={18} />
          </Link>
        )}

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
