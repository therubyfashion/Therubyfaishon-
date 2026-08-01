import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Truck, MapPin, Clock, PackageCheck, AlertCircle, ShieldCheck, Mail, ChevronLeft, Sparkles, Navigation } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

interface ShippingMethod {
  id: string;
  name: string;
  timeline: string;
  costText: string;
  extraInfo?: string;
  icon: string;
}

export default function ShippingPolicy() {
  const { settings } = useSettings();
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const freeThreshold = settings?.freeShippingThreshold || 499;

  useEffect(() => {
    // Attempt to parse custom shipping methods from store settings if configured, else use default verified list
    let methods: ShippingMethod[] = [];
    if (settings?.shippingMethods && Array.isArray(settings.shippingMethods) && settings.shippingMethods.length > 0) {
      methods = settings.shippingMethods;
    } else {
      methods = [
        {
          id: 'standard',
          name: 'Standard Delivery',
          timeline: '5-7 Business Days',
          costText: `FREE on orders above ₹${freeThreshold} (₹49 charge for orders under ₹${freeThreshold})`,
          extraInfo: 'Available pan-India across 19,000+ pin codes.',
          icon: 'standard'
        },
        {
          id: 'express',
          name: 'Express Shipping',
          timeline: '2-3 Business Days',
          costText: '₹99 Flat Charge',
          extraInfo: 'Priority air courier dispatch for urgent orders.',
          icon: 'express'
        },
        {
          id: 'sameday',
          name: 'Same Day Delivery',
          timeline: 'Delivered Today (Order before 12 PM)',
          costText: '₹149 Extra',
          extraInfo: 'Available in select metro cities (Mumbai, Delhi NCR, Bangalore).',
          icon: 'sameday'
        }
      ];
    }
    setShippingMethods(methods);
  }, [settings, freeThreshold]);

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
            <span className="text-[11px] font-bold uppercase tracking-[0.3em]">Pan-India Logistics</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl md:text-5xl font-serif font-bold text-[#1A2C54] tracking-tight">
              Shipping & Delivery Policy
            </h1>
            <p className="text-gray-500 text-sm md:text-base font-light leading-relaxed">
              At <strong className="font-semibold text-gray-800">The Ruby Fashion</strong>, we ensure fast, reliable, and secure delivery of your luxury ethnic wear right to your doorstep anywhere in India. Free delivery applies on orders above ₹{freeThreshold}.
            </p>
          </div>

          {/* Key Shipping Specs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-gray-100 pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#A11B35]/10 text-[#A11B35] flex items-center justify-center shrink-0">
                <Truck size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-[#1A2C54]">Free Delivery</p>
                <p className="text-[10px] text-gray-400">On orders above ₹{freeThreshold}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#A11B35]/10 text-[#A11B35] flex items-center justify-center shrink-0">
                <Navigation size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-[#1A2C54]">Live Order Tracking</p>
                <p className="text-[10px] text-gray-400">24/7 via My Orders in app</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#A11B35]/10 text-[#A11B35] flex items-center justify-center shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-[#1A2C54]">Insured Dispatch</p>
                <p className="text-[10px] text-gray-400">Tamper-proof packaging</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Content Sections */}
        <div className="space-y-8">
          
          {/* Section 1: Configured Shipping Methods */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-[2rem] p-8 md:p-10 shadow-sm border border-gray-100 space-y-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#A11B35]/10 text-[#A11B35] flex items-center justify-center shrink-0">
                <Truck size={22} />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-serif font-bold text-[#1A2C54]">
                  Shipping Options & Delivery Timelines
                </h2>
                <p className="text-xs text-gray-400">Choose your preferred shipping speed during checkout</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              {shippingMethods.map((method) => (
                <div key={method.id} className="bg-[#FAFAFA] p-6 rounded-2xl border border-gray-100 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <span className="inline-block bg-[#1A2C54] text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md">
                      {method.name}
                    </span>
                    <h3 className="text-sm font-bold text-[#1A2C54] flex items-center gap-1.5 pt-1">
                      <Clock size={14} className="text-[#A11B35]" />
                      {method.timeline}
                    </h3>
                    <p className="text-xs font-semibold text-[#A11B35]">
                      {method.costText}
                    </p>
                    {method.extraInfo && (
                      <p className="text-[11px] text-gray-500 font-light leading-relaxed pt-1 border-t border-gray-200/60">
                        {method.extraInfo}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Section 2: Order Tracking */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-[2rem] p-8 md:p-10 shadow-sm border border-gray-100 space-y-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#A11B35]/10 text-[#A11B35] flex items-center justify-center shrink-0">
                <PackageCheck size={22} />
              </div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-[#1A2C54]">
                Order Tracking Information
              </h2>
            </div>

            <p className="text-gray-600 text-sm leading-relaxed font-light">
              You can track your order anytime via the <Link to="/my-orders" className="text-[#A11B35] font-semibold underline">My Orders</Link> section in the app or website. Once dispatched, you will receive a tracking link along with live AWB courier updates via email and SMS notifications.
            </p>

            <div className="bg-[#FAFAFA] p-5 rounded-2xl border border-gray-100 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-bold text-[#1A2C54]">Want to check your current order state?</p>
                <p className="text-xs text-gray-500 font-light">Enter your order ID or phone number to view live courier status.</p>
              </div>
              <Link 
                to="/track"
                className="bg-[#1A2C54] hover:bg-[#A11B35] text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shrink-0"
              >
                Track Order
              </Link>
            </div>
          </motion.div>

          {/* Section 3: Delivery Partners & Non-Serviceable Areas */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {/* Delivery Partners */}
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 space-y-4">
              <div className="flex items-center gap-3 text-[#1A2C54]">
                <MapPin size={22} className="text-[#A11B35]" />
                <h2 className="text-lg font-serif font-bold">Trusted Courier Partners</h2>
              </div>
              <p className="text-xs text-gray-500 font-light leading-relaxed">
                We partner with India's leading logistics providers to ensure fast and safe transit:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {['Delhivery', 'BlueDart', 'Xpressbees', 'Shadowfax', 'India Post'].map((partner) => (
                  <span key={partner} className="bg-[#FAFAFA] border border-gray-200 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-xl">
                    {partner}
                  </span>
                ))}
              </div>
            </div>

            {/* Non-Serviceable Policy */}
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 space-y-4">
              <div className="flex items-center gap-3 text-[#1A2C54]">
                <AlertCircle size={22} className="text-amber-500" />
                <h2 className="text-lg font-serif font-bold">Non-Serviceable Areas Policy</h2>
              </div>
              <p className="text-xs text-gray-500 font-light leading-relaxed">
                In rare cases where a pin code is remote or non-serviceable by private couriers, our team will dispatch via India Post Speed Post. If delivery is completely impossible, our team will contact you within 24 hours to issue a full 100% refund.
              </p>
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
              <h3 className="text-xl font-serif font-bold">Shipping Query or Delay?</h3>
              <p className="text-gray-300 text-xs font-light">
                Our support team is here to assist with address modifications and shipping updates.
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
