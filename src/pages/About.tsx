import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ShieldCheck, RotateCcw, Award, Mail, Phone, MapPin, Heart, ChevronLeft } from 'lucide-react';

export default function About() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] pt-28 pb-24 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Navigation Breadcrumb */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 hover:text-[#A11B35] transition-colors"
        >
          <ChevronLeft size={16} />
          Back to Home
        </Link>

        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.06)] border border-gray-100/80 text-center space-y-6 relative overflow-hidden"
        >
          <div className="inline-flex items-center gap-2 text-[#A11B35] bg-[#A11B35]/10 px-4 py-1.5 rounded-full">
            <Sparkles size={16} />
            <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Our Story & Mission</span>
          </div>

          <h1 className="text-3xl md:text-6xl font-serif font-bold text-[#1A2C54] tracking-tight">
            The Ruby Fashion
          </h1>

          <p className="text-lg md:text-xl font-serif italic text-[#A11B35]">
            "Premium ethnic wear for modern Indian women"
          </p>

          <p className="text-gray-500 text-sm md:text-base font-light leading-relaxed max-w-2xl mx-auto">
            Born out of a deep reverence for Indian heritage and modern aesthetic elegance, The Ruby Fashion celebrates the timeless splendor of women's ethnic clothing. From hand-crafted kurtis and intricate sarees to majestic bridal lehengas, we blend traditional weaving mastery with contemporary cuts.
          </p>
        </motion.div>

        {/* Mission Statement */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-[2rem] p-8 md:p-10 shadow-sm border border-gray-100 space-y-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#A11B35]/10 text-[#A11B35] flex items-center justify-center shrink-0">
              <Heart size={22} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-[#1A2C54]">Our Mission</h2>
              <p className="text-xs text-gray-400">Crafting grace, comfort, and authenticity</p>
            </div>
          </div>

          <p className="text-gray-600 text-sm leading-relaxed font-light">
            Our mission is to empower every woman to embrace her inner radiance through exquisite, high-quality ethnic wear. We believe luxury fashion should be accessible, comfortable, and ethically sourced. Each piece in our collection undergoes stringent quality checks to ensure flawless stitching, premium dyes, and luxurious feel against the skin.
          </p>
        </motion.div>

        {/* Why Choose Us - 3 Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-serif font-bold text-[#1A2C54]">Why Choose Us</h2>
            <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Uncompromising Standards of Excellence</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-3 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-[#A11B35]/10 text-[#A11B35] flex items-center justify-center">
                <Award size={24} />
              </div>
              <h3 className="text-sm font-bold text-[#1A2C54] uppercase tracking-wider">Unmatched Quality</h3>
              <p className="text-xs text-gray-500 font-light leading-relaxed">
                Hand-selected fabrics, breathable pure cottons, rich silks, and meticulous zardozi/embroidery work.
              </p>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-3 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-[#A11B35]/10 text-[#A11B35] flex items-center justify-center">
                <RotateCcw size={24} />
              </div>
              <h3 className="text-sm font-bold text-[#1A2C54] uppercase tracking-wider">7-Day Easy Returns</h3>
              <p className="text-xs text-gray-500 font-light leading-relaxed">
                Hassle-free doorstep collection and rapid refunds for total peace of mind.
              </p>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-3 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-[#A11B35]/10 text-[#A11B35] flex items-center justify-center">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-sm font-bold text-[#1A2C54] uppercase tracking-wider">100% Secure Payments</h3>
              <p className="text-xs text-gray-500 font-light leading-relaxed">
                Razorpay encrypted gateway, UPI options, and Cash on Delivery across India.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Contact Info Box */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#1A2C54] text-white rounded-[2.5rem] p-8 md:p-12 space-y-8 shadow-xl"
        >
          <div className="space-y-2 text-center md:text-left">
            <h2 className="text-2xl font-serif font-bold">Connect With Us</h2>
            <p className="text-gray-300 text-xs font-light">We're always here to assist you with your ethnic fashion needs.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#A11B35] text-white flex items-center justify-center shrink-0">
                <Mail size={18} />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Email Us</p>
                <a href="mailto:support@therubyfashion.shop" className="text-xs font-semibold text-white hover:text-[#A11B35]">
                  support@therubyfashion.shop
                </a>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#A11B35] text-white flex items-center justify-center shrink-0">
                <Phone size={18} />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Customer Support</p>
                <p className="text-xs font-semibold text-white">+91 98765 43210</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#A11B35] text-white flex items-center justify-center shrink-0">
                <MapPin size={18} />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Headquarters</p>
                <p className="text-xs font-semibold text-white">Mumbai, Maharashtra, India</p>
              </div>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
