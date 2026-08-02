import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, AlertTriangle, XCircle, ShoppingBag, ArrowRight, Clock, Mail } from 'lucide-react';
import confetti from 'canvas-confetti';

type VerificationState = 'loading' | 'success' | 'already_verified' | 'expired' | 'not_found' | 'error';

export const VerifyCOD: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const orderParam = searchParams.get('order') || '';
  const navigate = useNavigate();

  const [state, setState] = useState<VerificationState>('loading');
  const [orderNumber, setOrderNumber] = useState<string>(orderParam);
  const [customerName, setCustomerName] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(5);

  useEffect(() => {
    let isMounted = true;

    const verifyToken = async () => {
      if (!token) {
        if (isMounted) setState('not_found');
        return;
      }

      try {
        const res = await fetch(`/api/verify-cod?token=${encodeURIComponent(token)}&order=${encodeURIComponent(orderParam)}`);
        const data = await res.json();

        if (!isMounted) return;

        if (data.orderNumber) setOrderNumber(data.orderNumber);
        if (data.customerName) setCustomerName(data.customerName);

        if (data.success) {
          setState('success');
          // Fire celebratory confetti
          try {
            confetti({
              particleCount: 150,
              spread: 80,
              colors: ['#A11B35', '#FFD700', '#FFFFFF', '#059669'],
              origin: { y: 0.6 }
            });
          } catch (e) {
            console.error('Confetti error:', e);
          }
        } else {
          if (data.reason === 'already_verified') {
            setState('already_verified');
          } else if (data.reason === 'expired') {
            setState('expired');
          } else if (data.reason === 'not_found') {
            setState('not_found');
          } else {
            setState('error');
          }
        }
      } catch (err) {
        console.error('Verification request failed:', err);
        if (isMounted) setState('error');
      }
    };

    verifyToken();

    return () => {
      isMounted = false;
    };
  }, [token, orderParam]);

  // Countdown timer for auto-redirect on success
  useEffect(() => {
    if (state !== 'success') return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/my-orders');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [state, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden text-center p-6 sm:p-8 relative">
        {/* Top Brand Stripe */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-[#A11B35]" />

        {/* LOADING STATE */}
        {state === 'loading' && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4">
            <div className="w-14 h-14 border-4 border-[#A11B35]/20 border-t-[#A11B35] rounded-full animate-spin" />
            <h2 className="text-xl font-bold text-slate-800">Verifying Your Order...</h2>
            <p className="text-sm text-slate-500 max-w-xs">
              Please wait a moment while we confirm your Cash on Delivery request.
            </p>
          </div>
        )}

        {/* SUCCESS STATE */}
        {state === 'success' && (
          <div className="py-4 space-y-6">
            <div className="mx-auto w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 ring-8 ring-emerald-50/50 animate-bounce">
              <CheckCircle className="w-12 h-12" />
            </div>

            <div className="space-y-2">
              <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider rounded-full">
                COD Verified
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Order Confirmed! 🎉
              </h1>
              <p className="text-slate-600 text-sm leading-relaxed max-w-sm mx-auto">
                Thank you <span className="font-semibold text-slate-900">{customerName || 'Customer'}</span>! Your order{' '}
                <span className="font-bold text-[#A11B35]">{orderNumber?.startsWith('#') ? orderNumber : `#${orderNumber}`}</span> has been successfully verified and is now being processed.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs text-slate-500 flex items-center justify-center space-x-2">
              <Clock className="w-4 h-4 text-[#A11B35]" />
              <span>
                Redirecting to your orders in <strong className="text-slate-900 font-bold">{countdown}</strong> seconds...
              </span>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={() => navigate('/my-orders')}
                className="w-full py-3.5 px-6 bg-[#A11B35] hover:bg-[#801429] text-white font-bold rounded-xl shadow-lg shadow-[#A11B35]/20 transition-all flex items-center justify-center space-x-2 group cursor-pointer"
              >
                <span>Track My Order</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <Link
                to="/"
                className="block w-full py-3 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        )}

        {/* ALREADY VERIFIED STATE */}
        {state === 'already_verified' && (
          <div className="py-4 space-y-6">
            <div className="mx-auto w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 ring-8 ring-emerald-50/50">
              <CheckCircle className="w-12 h-12" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-900">
                Order Already Confirmed ✅
              </h1>
              <p className="text-slate-600 text-sm leading-relaxed max-w-sm mx-auto">
                Order <span className="font-bold text-[#A11B35]">{orderNumber?.startsWith('#') ? orderNumber : `#${orderNumber}`}</span> has already been verified and is being processed by our team.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => navigate('/my-orders')}
                className="w-full py-3.5 px-6 bg-[#A11B35] hover:bg-[#801429] text-white font-bold rounded-xl shadow-lg shadow-[#A11B35]/20 transition-all flex items-center justify-center space-x-2 group cursor-pointer"
              >
                <span>Track My Order</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}

        {/* EXPIRED STATE */}
        {state === 'expired' && (
          <div className="py-4 space-y-6">
            <div className="mx-auto w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 ring-8 ring-amber-50/50">
              <AlertTriangle className="w-12 h-12" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-900">
                Link Expired ⏳
              </h1>
              <p className="text-slate-600 text-sm leading-relaxed max-w-sm mx-auto">
                This verification link for order <span className="font-bold text-slate-800">{orderNumber?.startsWith('#') ? orderNumber : `#${orderNumber}`}</span> has expired after 24 hours.
              </p>
              <p className="text-slate-500 text-xs">
                Your order may have been automatically cancelled. Please contact our support team if you still wish to complete your purchase.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <a
                href="mailto:support@therubyfashion.shop"
                className="w-full py-3.5 px-6 bg-[#A11B35] hover:bg-[#801429] text-white font-bold rounded-xl shadow-lg shadow-[#A11B35]/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Mail className="w-4 h-4" />
                <span>Contact Support</span>
              </a>

              <Link
                to="/"
                className="block w-full py-3 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
              >
                Return to Shop
              </Link>
            </div>
          </div>
        )}

        {/* NOT FOUND / ERROR STATE */}
        {(state === 'not_found' || state === 'error') && (
          <div className="py-4 space-y-6">
            <div className="mx-auto w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-600 ring-8 ring-red-50/50">
              <XCircle className="w-12 h-12" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-900">
                Invalid Verification Link ❌
              </h1>
              <p className="text-slate-600 text-sm leading-relaxed max-w-sm mx-auto">
                We couldn't locate a pending COD order matching this verification link. Please check your order details or contact support.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <Link
                to="/"
                className="w-full py-3.5 px-6 bg-[#A11B35] hover:bg-[#801429] text-white font-bold rounded-xl shadow-lg shadow-[#A11B35]/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Return to Home</span>
              </Link>

              <a
                href="mailto:support@therubyfashion.shop"
                className="block w-full py-3 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
              >
                Contact Support
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyCOD;
