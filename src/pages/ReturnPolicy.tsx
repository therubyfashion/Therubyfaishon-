import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RotateCcw, Clock, CheckCircle, XCircle, ArrowRight, Wallet, Mail, ChevronLeft, Sparkles, RefreshCw } from 'lucide-react';

export default function ReturnPolicy() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] pt-28 pb-24 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-10">
        
        {/* Navigation Breadcrumb */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 hover:text-[#A11B35] transition-colors"
        >
          <ChevronLeft size={16} />
          Back to Home
        </Link>

        {/* Hero Banner Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.06)] border border-gray-100/80 space-y-6"
        >
          <div className="flex items-center gap-2 text-[#A11B35]">
            <Sparkles size={18} />
            <span className="text-[11px] font-bold uppercase tracking-[0.3em]">Hassle-Free Returns</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl md:text-5xl font-serif font-bold text-[#1A2C54] tracking-tight">
              Return & Refund Policy
            </h1>
            <p className="text-gray-500 text-sm md:text-base font-light leading-relaxed">
              We want you to love everything you purchase from <strong className="font-semibold text-gray-800">The Ruby Fashion</strong>. If an item doesn't fit or meet your expectations, our straightforward 7-day return policy ensures a simple and smooth return process.
            </p>
          </div>

          {/* Quick Highlight Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-gray-100 pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#A11B35]/10 text-[#A11B35] flex items-center justify-center shrink-0">
                <Clock size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-[#1A2C54]">7 Days Window</p>
                <p className="text-[10px] text-gray-400">From date of delivery</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#A11B35]/10 text-[#A11B35] flex items-center justify-center shrink-0">
                <RotateCcw size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-[#1A2C54]">Doorstep Pickup</p>
                <p className="text-[10px] text-gray-400">Arranged by us</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#A11B35]/10 text-[#A11B35] flex items-center justify-center shrink-0">
                <Wallet size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-[#1A2C54]">5-7 Days Refund</p>
                <p className="text-[10px] text-gray-400">Post quality check</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Content Sections */}
        <div className="space-y-8">
          
          {/* Eligibility Breakdown */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {/* Eligible Items */}
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 space-y-4">
              <div className="flex items-center gap-3 text-emerald-600">
                <CheckCircle size={22} />
                <h2 className="text-lg font-serif font-bold text-[#1A2C54]">Eligible for Return</h2>
              </div>
              <ul className="space-y-2.5 text-xs text-gray-600 font-light">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">•</span>
                  Items returned within 7 days of delivery timestamp.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">•</span>
                  Unused, unworn, unwashed, and undamaged garments.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">•</span>
                  Original brand tags, security loops, and polybag intact.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">•</span>
                  Defective or incorrect items received.
                </li>
              </ul>
            </div>

            {/* Non-Returnable Items */}
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 space-y-4">
              <div className="flex items-center gap-3 text-rose-500">
                <XCircle size={22} />
                <h2 className="text-lg font-serif font-bold text-[#1A2C54]">Non-Returnable Items</h2>
              </div>
              <ul className="space-y-2.5 text-xs text-gray-600 font-light">
                <li className="flex items-start gap-2">
                  <span className="text-rose-500 font-bold">•</span>
                  Innerwear, lingerie, or shapewear for hygiene reasons.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-500 font-bold">•</span>
                  Customized or altered stitching products.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-500 font-bold">•</span>
                  Clearance or final sale collection items.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-500 font-bold">•</span>
                  Items missing original tags or showing signs of wear/perfume.
                </li>
              </ul>
            </div>
          </motion.div>

          {/* 3 Step Return Process */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-[2rem] p-8 md:p-10 shadow-sm border border-gray-100 space-y-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#A11B35]/10 text-[#A11B35] flex items-center justify-center shrink-0">
                <RefreshCw size={22} />
              </div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-[#1A2C54]">
                How to Request a Return (Step-by-Step)
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              <div className="bg-[#FAFAFA] p-6 rounded-2xl border border-gray-100 space-y-3 relative">
                <div className="w-8 h-8 rounded-full bg-[#1A2C54] text-white text-xs font-bold flex items-center justify-center">1</div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A2C54]">Request via App</h3>
                <p className="text-xs text-gray-500 font-light leading-relaxed">
                  Go to <Link to="/my-orders" className="text-[#A11B35] font-semibold underline">My Orders</Link>, select your order, and tap "Request Return / Refund".
                </p>
              </div>

              <div className="bg-[#FAFAFA] p-6 rounded-2xl border border-gray-100 space-y-3 relative">
                <div className="w-8 h-8 rounded-full bg-[#A11B35] text-white text-xs font-bold flex items-center justify-center">2</div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A2C54]">Free Pickup</h3>
                <p className="text-xs text-gray-500 font-light leading-relaxed">
                  Our courier partner will collect the package from your doorstep within 24-48 hours.
                </p>
              </div>

              <div className="bg-[#FAFAFA] p-6 rounded-2xl border border-gray-100 space-y-3 relative">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">3</div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A2C54]">Quality Check & Refund</h3>
                <p className="text-xs text-gray-500 font-light leading-relaxed">
                  Once received and inspected, your refund will be processed in 5-7 business days.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Refund Method Details */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-[2rem] p-8 md:p-10 shadow-sm border border-gray-100 space-y-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#A11B35]/10 text-[#A11B35] flex items-center justify-center shrink-0">
                <Wallet size={22} />
              </div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-[#1A2C54]">
                Refund Methods & Timelines
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#FAFAFA] p-6 rounded-2xl border border-gray-100 space-y-2">
                <span className="inline-block bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">Online Payments</span>
                <h3 className="text-sm font-bold text-[#1A2C54]">Razorpay / Prepaid Refund</h3>
                <p className="text-xs text-gray-500 font-light leading-relaxed">
                  Refunded directly back to your original source account (UPI, Debit Card, Credit Card, or Net Banking) via Razorpay within 5-7 business days.
                </p>
              </div>

              <div className="bg-[#FAFAFA] p-6 rounded-2xl border border-gray-100 space-y-2">
                <span className="inline-block bg-blue-100 text-blue-800 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">COD Orders</span>
                <h3 className="text-sm font-bold text-[#1A2C54]">Bank Transfer / UPI Payout</h3>
                <p className="text-xs text-gray-500 font-light leading-relaxed">
                  For Cash on Delivery orders, we issue the refund directly to your Bank Account via UPI or IMPS transfer after taking your UPI ID / Bank details.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Contact Box */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-[#1A2C54] text-white rounded-[2.5rem] p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl"
          >
            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-xl font-serif font-bold">Need Help With a Return?</h3>
              <p className="text-gray-300 text-xs font-light">
                Our support team is available 24/7 to assist with exchanges and returns.
              </p>
            </div>
            <a 
              href="mailto:support@therubyfashion.shop"
              className="inline-flex items-center gap-2 bg-[#A11B35] hover:bg-[#801429] text-white px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shrink-0"
            >
              <Mail size={16} />
              support@therubyfashion.shop
            </a>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
