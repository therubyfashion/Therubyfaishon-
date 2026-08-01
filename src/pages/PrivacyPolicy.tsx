import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, Lock, Eye, Database, Share2, Cookie, UserCheck, Mail, ChevronLeft, Sparkles } from 'lucide-react';

export default function PrivacyPolicy() {
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
            <span className="text-[11px] font-bold uppercase tracking-[0.3em]">Legal & Security</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl md:text-5xl font-serif font-bold text-[#1A2C54] tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-gray-500 text-sm md:text-base font-light leading-relaxed">
              At <strong className="font-semibold text-gray-800">The Ruby Fashion</strong>, we respect your privacy and are committed to protecting your personal data. This Privacy Policy outlines how we collect, use, and safeguard your information when you visit or make a purchase from our online store.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-400 border-t border-gray-100 pt-6">
            <span>Last Updated: July 2026</span>
            <span>•</span>
            <span>Version 2.0</span>
          </div>
        </motion.div>

        {/* Main Content Sections */}
        <div className="space-y-8">
          
          {/* Section 1: Data We Collect */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-[2rem] p-8 md:p-10 shadow-sm border border-gray-100 space-y-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#A11B35]/10 text-[#A11B35] flex items-center justify-center shrink-0">
                <Database size={22} />
              </div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-[#1A2C54]">
                1. What Data We Collect
              </h2>
            </div>

            <p className="text-gray-600 text-sm leading-relaxed">
              When you interact with The Ruby Fashion, we collect information that helps us process your orders, provide customer support, and personalize your shopping experience:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {[
                { title: "Personal Identifier Info", desc: "Your full name, email address, phone number, and account login details." },
                { title: "Delivery & Shipping Info", desc: "Postal address, pin code, city, state, and recipient contact details." },
                { title: "Payment Details", desc: "Transaction tokens via secure gateways like Razorpay (we never store raw card or UPI PIN data)." },
                { title: "Device & Usage Data", desc: "IP address, browser type, device details, pages viewed, and session cookies." }
              ].map((item, idx) => (
                <div key={idx} className="bg-[#FAFAFA] p-5 rounded-2xl border border-gray-100 space-y-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A2C54]">{item.title}</h3>
                  <p className="text-xs text-gray-500 font-light leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Section 2: How We Use Your Data */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-[2rem] p-8 md:p-10 shadow-sm border border-gray-100 space-y-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#A11B35]/10 text-[#A11B35] flex items-center justify-center shrink-0">
                <Eye size={22} />
              </div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-[#1A2C54]">
                2. How We Use Your Information
              </h2>
            </div>

            <ul className="space-y-3 text-sm text-gray-600">
              {[
                "Processing and fulfilling your ethnic wear orders, returns, and refunds.",
                "Sending real-time order status updates, shipment tracking, and delivery notifications.",
                "Providing personalized customer support via live chat, email, or telephone.",
                "Sending promotional offers, exclusive sales updates, and style guides (only if opted-in).",
                "Preventing fraudulent transactions and ensuring overall website security."
              ].map((point, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#A11B35] mt-2 shrink-0" />
                  <span className="font-light leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Section 3: Data Sharing & Partners */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-[2rem] p-8 md:p-10 shadow-sm border border-gray-100 space-y-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#A11B35]/10 text-[#A11B35] flex items-center justify-center shrink-0">
                <Share2 size={22} />
              </div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-[#1A2C54]">
                3. Data Sharing & Third-Party Service Partners
              </h2>
            </div>

            <p className="text-gray-600 text-sm leading-relaxed">
              We do <strong className="font-semibold text-gray-800">not sell, rent, or trade</strong> your personal information to third parties. We only share necessary data with trusted partners required to operate our ecommerce services:
            </p>

            <div className="space-y-4">
              <div className="border-l-2 border-[#A11B35] pl-4 py-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A2C54]">Payment Processors (e.g. Razorpay)</h3>
                <p className="text-xs text-gray-500 font-light mt-1">
                  Securely process online payments, UPI, debit/credit cards, and net banking using PCI-DSS compliant encryption.
                </p>
              </div>

              <div className="border-l-2 border-[#A11B35] pl-4 py-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A2C54]">Courier & Shipping Partners</h3>
                <p className="text-xs text-gray-500 font-light mt-1">
                  Share shipping address and phone number with logistics providers (e.g., Delhivery, BlueDart, India Post) solely to deliver your orders.
                </p>
              </div>

              <div className="border-l-2 border-[#A11B35] pl-4 py-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A2C54]">Communication Services</h3>
                <p className="text-xs text-gray-500 font-light mt-1">
                  Send transactional emails, push notifications, or SMS alerts regarding your order status and verification.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Section 4: Cookie Policy */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-[2rem] p-8 md:p-10 shadow-sm border border-gray-100 space-y-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#A11B35]/10 text-[#A11B35] flex items-center justify-center shrink-0">
                <Cookie size={22} />
              </div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-[#1A2C54]">
                4. Cookie Policy
              </h2>
            </div>

            <p className="text-gray-600 text-sm leading-relaxed">
              We use cookies and similar tracking technologies to store your shopping cart items, keep you logged in, analyze site performance, and improve navigation. You can adjust your browser settings to decline cookies, though certain features of our website may not function as intended.
            </p>
          </motion.div>

          {/* Section 5: Your Data Rights */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-[2rem] p-8 md:p-10 shadow-sm border border-gray-100 space-y-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#A11B35]/10 text-[#A11B35] flex items-center justify-center shrink-0">
                <UserCheck size={22} />
              </div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-[#1A2C54]">
                5. User Rights & Account Deletion
              </h2>
            </div>

            <p className="text-gray-600 text-sm leading-relaxed">
              You have full rights over your data stored with us:
            </p>

            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <li className="bg-[#FAFAFA] p-4 rounded-xl border border-gray-100 text-xs text-gray-600">
                <strong className="block text-[#1A2C54] font-bold mb-1">Access & Update:</strong> View and modify your stored shipping addresses and account details anytime in <Link to="/profile" className="text-[#A11B35] underline">Profile Settings</Link>.
              </li>
              <li className="bg-[#FAFAFA] p-4 rounded-xl border border-gray-100 text-xs text-gray-600">
                <strong className="block text-[#1A2C54] font-bold mb-1">Delete Account:</strong> Request permanent removal of your user profile and personal data by emailing support.
              </li>
            </ul>
          </motion.div>

          {/* Contact Box */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-[#1A2C54] text-white rounded-[2.5rem] p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl"
          >
            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-xl font-serif font-bold">Have Privacy Questions?</h3>
              <p className="text-gray-300 text-xs font-light">
                Reach out to our privacy compliance team anytime.
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
