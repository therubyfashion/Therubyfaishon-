import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, CheckCircle2, ShoppingBag, CreditCard, ShieldAlert, Gavel, Mail, ChevronLeft, Sparkles } from 'lucide-react';

export default function TermsOfService() {
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
            <span className="text-[11px] font-bold uppercase tracking-[0.3em]">Official Governance</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl md:text-5xl font-serif font-bold text-[#1A2C54] tracking-tight">
              Terms & Conditions
            </h1>
            <p className="text-gray-500 text-sm md:text-base font-light leading-relaxed">
              Welcome to <strong className="font-semibold text-gray-800">The Ruby Fashion</strong>. These Terms & Conditions govern your access to and use of our website, mobile platform, and purchase of our luxury women's ethnic wear. By using our platform, you agree to comply with these terms.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-400 border-t border-gray-100 pt-6">
            <span>Effective Date: July 2026</span>
            <span>•</span>
            <span>Applicable Jurisdiction: Mumbai, India</span>
          </div>
        </motion.div>

        {/* Sections */}
        <div className="space-y-8">
          
          {/* Section 1: Acceptance */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-[2rem] p-8 md:p-10 shadow-sm border border-gray-100 space-y-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#A11B35]/10 text-[#A11B35] flex items-center justify-center shrink-0">
                <CheckCircle2 size={22} />
              </div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-[#1A2C54]">
                1. Acceptance of Terms
              </h2>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed font-light">
              By browsing, accessing, registering an account, or placing an order on The Ruby Fashion, you confirm that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree with any part of these terms, please refrain from using our store.
            </p>
          </motion.div>

          {/* Section 2: Products & Pricing */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-[2rem] p-8 md:p-10 shadow-sm border border-gray-100 space-y-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#A11B35]/10 text-[#A11B35] flex items-center justify-center shrink-0">
                <ShoppingBag size={22} />
              </div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-[#1A2C54]">
                2. Products & Pricing
              </h2>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed font-light">
              We make every effort to accurately display the colors, fabrics, and designs of our ethnic wear products (kurtis, sarees, lehengas, suits). However, actual screen colors may vary slightly depending on monitor settings.
            </p>
            <ul className="list-disc pl-5 text-sm text-gray-600 font-light space-y-2">
              <li>All prices listed on the store are in Indian Rupees (INR ₹) and include applicable taxes unless specified otherwise.</li>
              <li>Prices and stock availability are subject to change without prior notice.</li>
              <li>In the event of a pricing error or technical glitch, we reserve the right to cancel affected orders and issue a full refund.</li>
            </ul>
          </motion.div>

          {/* Section 3: Orders & Payment Terms */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-[2rem] p-8 md:p-10 shadow-sm border border-gray-100 space-y-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#A11B35]/10 text-[#A11B35] flex items-center justify-center shrink-0">
                <CreditCard size={22} />
              </div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-[#1A2C54]">
                3. Order Placement & Payment Terms
              </h2>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed font-light">
              An order is considered placed once you complete the checkout workflow and receive an order confirmation email or notification.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="bg-[#FAFAFA] p-4 rounded-xl border border-gray-100 space-y-1">
                <h3 className="text-xs font-bold uppercase text-[#1A2C54]">Online Prepaid via Razorpay</h3>
                <p className="text-xs text-gray-500 font-light">Pay securely using UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, or Net Banking. Payment is processed immediately.</p>
              </div>
              <div className="bg-[#FAFAFA] p-4 rounded-xl border border-gray-100 space-y-1">
                <h3 className="text-xs font-bold uppercase text-[#1A2C54]">Cash on Delivery (COD)</h3>
                <p className="text-xs text-gray-500 font-light">Pay cash or UPI upon delivery at your doorstep. Exact amount required at delivery. Phone verification may be required.</p>
              </div>
            </div>
          </motion.div>

          {/* Section 4: Intellectual Property */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-[2rem] p-8 md:p-10 shadow-sm border border-gray-100 space-y-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#A11B35]/10 text-[#A11B35] flex items-center justify-center shrink-0">
                <FileText size={22} />
              </div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-[#1A2C54]">
                4. Intellectual Property Rights
              </h2>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed font-light">
              All content on The Ruby Fashion—including trademarks, brand logo, photography, product descriptions, code, graphics, and layout design—is the exclusive intellectual property of The Ruby Fashion. Unauthorized reproduction or commercial distribution is strictly prohibited.
            </p>
          </motion.div>

          {/* Section 5: Liability & Governing Law */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-[2rem] p-8 md:p-10 shadow-sm border border-gray-100 space-y-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#A11B35]/10 text-[#A11B35] flex items-center justify-center shrink-0">
                <Gavel size={22} />
              </div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-[#1A2C54]">
                5. Limitation of Liability & Governing Law
              </h2>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed font-light">
              To the fullest extent permitted by applicable law, The Ruby Fashion shall not be liable for indirect, incidental, or consequential damages resulting from site usage, shipping delays beyond our control, or external courier disruptions.
            </p>
            <div className="bg-[#FAFAFA] p-4 rounded-xl border border-gray-100">
              <p className="text-xs text-gray-700 font-semibold uppercase tracking-wider">Governing Law & Jurisdiction</p>
              <p className="text-xs text-gray-500 font-light mt-1">
                These terms are governed by the laws of India. Any disputes or claims arising hereunder shall be subject to the exclusive jurisdiction of the courts located in <strong className="font-semibold text-gray-800">Mumbai, Maharashtra, India</strong>.
              </p>
            </div>
          </motion.div>

          {/* Contact Box */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-[#1A2C54] text-white rounded-[2.5rem] p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl"
          >
            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-xl font-serif font-bold">Questions Regarding Terms?</h3>
              <p className="text-gray-300 text-xs font-light">
                Our support team is here to help with any legal or compliance queries.
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
