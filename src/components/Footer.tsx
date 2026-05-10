import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Instagram, Facebook, Youtube, Twitter,
  ShoppingBag, Truck, RotateCcw, 
  Headphones, Award, ChevronDown, 
  ShieldCheck, Lock, ArrowUp,
  LayoutGrid, User, Headphones as HelpIcon,
  MapPin, Package,
  ChevronRight,
  HandCoins
} from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

interface AccordionItemProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function FooterAccordion({ title, icon, children }: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-white/5 last:border-none">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-5 px-4 group hover:bg-white/[0.02] transition-all"
      >
        <div className="flex items-center gap-4">
          <div className="text-gray-400 group-hover:text-ruby transition-colors">
            {icon}
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/90 group-hover:text-white transition-colors">
            {title}
          </span>
        </div>
        <ChevronDown 
          size={16} 
          className={cn("text-gray-600 transition-transform duration-500", isOpen && "rotate-180 text-ruby")} 
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-14 pb-6 space-y-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Footer() {
  const { settings } = useSettings();
  const navigate = useNavigate();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const socialLinks = [
    { id: 'instagram', icon: Instagram, url: settings?.footerSocials?.instagram, color: 'hover:bg-[#E1306C]' },
    { id: 'facebook', icon: Facebook, url: settings?.footerSocials?.facebook, color: 'hover:bg-[#1877F2]' },
    { id: 'youtube', icon: Youtube, url: settings?.footerSocials?.youtube, color: 'hover:bg-[#FF0000]' },
    { id: 'twitter', icon: Twitter, url: settings?.footerSocials?.x || settings?.footerSocials?.twitter, color: 'hover:bg-sky-500' }
  ].filter(link => link.url);

  return (
    <footer className="bg-[#111214] text-white pt-20 pb-16 relative overflow-hidden border-t border-white/5 font-sans">
      {/* Background elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-px bg-gradient-to-r from-transparent via-ruby/30 to-transparent" />
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-ruby/5 rounded-full blur-[150px] -translate-y-1/2 pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6 relative z-10 flex flex-col items-center">
        {/* LOGO SECTION */}
        <div className="text-center space-y-6 mb-16">
          <div className="inline-flex flex-col items-center group cursor-pointer" onClick={() => navigate('/')}>
             <div className="w-14 h-14 border border-ruby/30 rounded-full flex items-center justify-center mb-1 group-hover:scale-105 transition-transform duration-500">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-ruby drop-shadow-[0_0_8px_rgba(224,30,90,0.4)]">
                  <path d="M6 3H12L15 3L22 9L12 21L2 9L6 3Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 21L8 9L12 3L16 9L12 21Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 9H22" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
             </div>
             <h3 className="text-4xl font-serif font-bold text-white tracking-tight">The <span className="text-white">Ruby</span></h3>
             <div className="flex flex-col items-center mt-3">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">Elevate Your Style</span>
                <div className="flex items-center gap-4 w-full mt-4">
                  <div className="h-px w-20 bg-gradient-to-r from-transparent to-white/20" />
                  <div className="w-1.5 h-1.5 bg-ruby rotate-45 animate-pulse" />
                  <div className="h-px w-20 bg-gradient-to-l from-transparent to-white/20" />
                </div>
             </div>
          </div>
        </div>

        {/* HIGHLIGHTS GRID - Separate boxes as requested */}
        <div className="grid grid-cols-2 gap-4 w-full mb-12">
          {[
            { icon: <Truck size={24} />, title: "Free Shipping", desc: "On all prepaid orders" },
            { icon: <Award size={24} />, title: "Premium Quality", desc: "Finest fabrics & stitching" },
            { icon: <RotateCcw size={24} />, title: "Easy Returns", desc: "7 days easy return policy" },
            { icon: <HelpIcon size={24} />, title: "24/7 Support", desc: "We're here to help you" },
          ].map((item, idx) => (
            <div key={idx} className="bg-[#0A0B0D]/50 border border-white/5 p-6 flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-6 group hover:bg-white/[0.04] transition-all hover:border-ruby/30 rounded-[1.5rem] shadow-lg">
              <div className="text-ruby transition-transform duration-500 group-hover:scale-110 flex-shrink-0">
                {item.icon}
              </div>
              <div className="space-y-1">
                <h4 className="text-[11px] sm:text-[12px] font-bold uppercase tracking-widest text-white/90">{item.title}</h4>
                <p className="text-[9px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-tight">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ACCORDION NAVIGATION */}
        <div className="w-full bg-[#0A0B0D]/50 border border-white/5 rounded-[2rem] overflow-hidden mb-16 shadow-xl">
          <FooterAccordion title="Shop" icon={<ShoppingBag size={18} />}>
            {['New Arrivals', 'Best Sellers', 'Western Wear', 'Sale'].map(item => (
              <Link key={item} to="/shop" className="block text-[11px] text-gray-500 hover:text-ruby py-2 uppercase tracking-[0.2em] font-bold transition-colors">{item}</Link>
            ))}
          </FooterAccordion>
          <FooterAccordion title="Categories" icon={<LayoutGrid size={18} />}>
            {['Dresses', 'Tops', 'Bottoms', 'Accessories'].map(item => (
              <Link key={item} to="/shop" className="block text-[11px] text-gray-500 hover:text-ruby py-2 uppercase tracking-[0.2em] font-bold transition-colors">{item}</Link>
            ))}
          </FooterAccordion>
          <FooterAccordion title="About Us" icon={<User size={18} />}>
            {['Our Story', 'Privacy Policy', 'Terms of Use', 'Contact'].map(item => (
              <Link key={item} to="/about" className="block text-[11px] text-gray-500 hover:text-ruby py-2 uppercase tracking-[0.2em] font-bold transition-colors">{item}</Link>
            ))}
          </FooterAccordion>
          <FooterAccordion title="Help & Support" icon={<HelpIcon size={18} />}>
            {['FAQ', 'Shipping Info', 'Returns', 'Size Guide'].map(item => (
              <Link key={item} to="/contact" className="block text-[11px] text-gray-500 hover:text-ruby py-2 uppercase tracking-[0.2em] font-bold transition-colors">{item}</Link>
            ))}
          </FooterAccordion>
          <FooterAccordion title="Store Locator" icon={<MapPin size={18} />}>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] leading-relaxed py-2">
              Find our boutique locations across major cities.
            </p>
          </FooterAccordion>
          <FooterAccordion title="Track Order" icon={<Package size={18} />}>
            <Link to="/track" className="inline-flex items-center gap-3 text-[11px] text-ruby font-bold uppercase tracking-[0.2em] py-2">
              Check Status <ChevronRight size={12} />
            </Link>
          </FooterAccordion>
        </div>

        {/* PAYMENTS SECTION - UPI & COD ONLY */}
        <div className="text-center space-y-8 mb-16 w-full">
          <div className="flex items-center gap-6">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500">WE ACCEPT</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
          </div>
          <div className="flex justify-center gap-6">
             {/* UPI LOGO - Using a more reliable SVG URL */}
             <div className="bg-white px-6 py-3 rounded-xl flex items-center justify-center min-w-[120px] h-14 transform hover:scale-105 transition-transform shadow-lg shadow-black/20 group">
               <img 
                 src="https://www.vectorlogo.zone/logos/upi/upi-ar21.svg" 
                 alt="UPI" 
                 className="h-8 w-auto object-contain" 
               />
             </div>
             {/* COD BOX - Added Icon for better look */}
             <div className="bg-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 min-w-[140px] h-14 transform hover:scale-105 transition-transform shadow-lg shadow-black/20 group">
               <HandCoins size={20} className="text-ruby" />
               <div className="flex flex-col items-start">
                 <span className="text-[10px] font-black text-black leading-none tracking-tighter">CASH ON</span>
                 <span className="text-[10px] font-black text-ruby leading-none tracking-tighter uppercase">Delivery</span>
               </div>
             </div>
          </div>
        </div>

        {/* TRUST BADGES - Single line layout */}
        <div className="flex flex-col sm:flex-row gap-4 w-full mb-16">
          <div className="flex-1 flex items-center justify-center gap-5 bg-white/[0.02] border border-white/5 p-6 rounded-[1.5rem] hover:border-ruby/20 transition-colors">
             <ShieldCheck size={24} className="text-ruby/80 drop-shadow-[0_0_8px_rgba(224,30,90,0.3)]" />
             <div className="text-left">
               <p className="text-[11px] font-bold text-white/90 uppercase tracking-widest">Secure Payments</p>
               <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest leading-none">100% secure & trusted</p>
             </div>
          </div>
          <div className="flex-1 flex items-center justify-center gap-5 bg-white/[0.02] border border-white/5 p-6 rounded-[1.5rem] hover:border-ruby/20 transition-colors">
             <Lock size={24} className="text-ruby/80 drop-shadow-[0_0_8px_rgba(224,30,90,0.3)]" />
             <div className="text-left">
               <p className="text-[11px] font-bold text-white/90 uppercase tracking-widest">Privacy Protected</p>
               <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest leading-none">Your data is safe with us</p>
             </div>
          </div>
        </div>

        {/* SOCIALS & CREDITS - Circles from image */}
        <div className="flex flex-col items-center gap-10 w-full pt-10 border-t border-white/5">
          {socialLinks.length > 0 && (
            <div className="flex items-center gap-5">
              {socialLinks.map((social) => (
                <a 
                  key={social.id} 
                  href={social.url} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn("w-12 h-12 bg-white/5 border border-white/5 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-all transform hover:-translate-y-2 shadow-xl", social.color)}
                >
                  <social.icon size={20} />
                </a>
              ))}
            </div>
          )}

          <div className="text-center pb-12">
            <p className="text-[11px] font-bold text-gray-600 uppercase tracking-[0.3em]">
              © 2026 {settings?.storeName?.toUpperCase() || 'THE RUBY FASHION'} - ALL RIGHTS RESERVED
            </p>
          </div>
        </div>

        {/* BACK TO TOP */}
        <motion.button 
          whileHover={{ scale: 1.1, translateY: -5 }}
          whileTap={{ scale: 0.9 }}
          onClick={scrollToTop}
          className="w-12 h-12 bg-[#141517] border border-white/10 rounded-full flex items-center justify-center text-gray-400 hover:text-ruby hover:border-ruby transition-all shadow-2xl absolute -bottom-4"
        >
          <ArrowUp size={20} />
        </motion.button>
      </div>
    </footer>
  );
}
