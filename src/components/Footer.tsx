import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Instagram, Facebook, Youtube, Twitter,
  ChevronDown, ShieldCheck, ArrowUp,
  MapPin, Mail, Clock, MessageCircle, HandCoins
} from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
}

function FooterAccordion({ title, children }: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-[#222] last:border-none">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 px-1 text-left group"
      >
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-white group-hover:text-[#A11B35] transition-colors">
          {title}
        </span>
        <ChevronDown 
          size={16} 
          className={cn("text-gray-400 transition-transform duration-300", isOpen && "rotate-180 text-[#A11B35]")} 
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
            <div className="px-1 pb-5 pt-1 space-y-2">
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
    { 
      id: 'instagram', 
      name: 'Instagram',
      icon: Instagram, 
      url: settings?.footerSocials?.instagram || '#'
    },
    { 
      id: 'facebook', 
      name: 'Facebook',
      icon: Facebook, 
      url: settings?.footerSocials?.facebook || '#'
    },
    { 
      id: 'whatsapp', 
      name: 'WhatsApp',
      icon: MessageCircle, 
      url: '#'
    },
  ];

  if (settings?.footerSocials?.youtube) {
    socialLinks.push({ id: 'youtube', name: 'YouTube', icon: Youtube, url: settings.footerSocials.youtube });
  }
  if (settings?.footerSocials?.x || settings?.footerSocials?.twitter) {
    socialLinks.push({ id: 'twitter', name: 'Twitter', icon: Twitter, url: settings.footerSocials.x || settings.footerSocials.twitter });
  }

  return (
    <footer className="bg-[#0D0D0D] text-white pt-12 pb-10 border-t border-[#222] font-sans relative">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        
        {/* 1. TOP SECTION - BRAND & STORY */}
        <div className="pb-10 border-b border-[#222] max-w-3xl">
          <div className="space-y-3">
            <Link to="/" className="inline-block group">
              <h2 className="text-2xl md:text-3xl font-serif font-bold text-white tracking-tight group-hover:text-[#A11B35] transition-colors">
                The Ruby Fashion
              </h2>
            </Link>
            <p className="text-xs sm:text-sm text-gray-300 font-normal leading-relaxed">
              The Ruby Fashion was born out of a deep passion for preserving timeless Indian craftsmanship while embracing contemporary elegance. We blend handcrafted textiles, intricate embroideries, and flattering modern silhouettes to empower women on every special occasion. From effortless festive kurtis to magnificent royal lehengas, each creation is crafted with rich fabrics, royal hues, and exceptional craftsmanship. Welcome to a legacy of grace, heritage, and timeless beauty.
            </p>
          </div>
        </div>

        {/* 2. MIDDLE SECTION - 4 COLUMN GRID (DESKTOP) / ACCORDION (MOBILE) */}
        
        {/* Desktop Grid */}
        <div className="hidden md:grid md:grid-cols-4 gap-8 py-12 border-b border-[#222]">
          {/* Column 1: Quick Links */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-white">Quick Links</h4>
            <ul className="space-y-2.5 text-xs text-gray-400">
              <li>
                <Link to="/" className="hover:text-[#A11B35] transition-colors">Home</Link>
              </li>
              <li>
                <Link to="/shop" className="hover:text-[#A11B35] transition-colors">Shop</Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-[#A11B35] transition-colors">About Us</Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-[#A11B35] transition-colors">Contact Us</Link>
              </li>
              <li>
                <Link to="/track" className="hover:text-[#A11B35] transition-colors">Track Order</Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Policies */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-white">Policies</h4>
            <ul className="space-y-2.5 text-xs text-gray-400">
              <li>
                <Link to="/faq" className="hover:text-[#A11B35] transition-colors">FAQs & Help</Link>
              </li>
              <li>
                <Link to="/privacy-policy" className="hover:text-[#A11B35] transition-colors">Privacy Policy</Link>
              </li>
              <li>
                <Link to="/terms-of-service" className="hover:text-[#A11B35] transition-colors">Terms & Conditions</Link>
              </li>
              <li>
                <Link to="/return-policy" className="hover:text-[#A11B35] transition-colors">Return & Refund Policy</Link>
              </li>
              <li>
                <Link to="/shipping-policy" className="hover:text-[#A11B35] transition-colors">Shipping Policy</Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Categories */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-white">Categories</h4>
            <ul className="space-y-2.5 text-xs text-gray-400">
              {[
                { name: 'Kurti', cat: 'Kurti' },
                { name: 'Saree', cat: 'Saree' },
                { name: 'Lehenga', cat: 'Lehenga' },
                { name: 'Suit Sets', cat: 'Suit Sets' },
                { name: 'Western Wear', cat: 'Western Wear' }
              ].map(item => (
                <li key={item.name}>
                  <Link to={`/shop?category=${encodeURIComponent(item.cat)}`} className="hover:text-[#A11B35] transition-colors">
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Contact & Support */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-white">Contact & Support</h4>
            <div className="space-y-3 text-xs text-gray-400">
              <a href="mailto:support@therubyfashion.shop" className="flex items-center gap-2 hover:text-[#A11B35] transition-colors">
                <Mail size={14} className="text-[#A11B35] shrink-0" />
                <span>support@therubyfashion.shop</span>
              </a>
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-[#A11B35] shrink-0" />
                <span>Mon-Sat: 10AM - 7PM</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-[#A11B35] shrink-0" />
                <span>Mumbai, India</span>
              </div>

              {/* Social Media Icons */}
              <div className="pt-2 flex items-center gap-3">
                {socialLinks.map(social => (
                  <a
                    key={social.id}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.name}
                    className="w-9 h-9 bg-[#181818] border border-[#2a2a2a] rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#A11B35] hover:border-[#A11B35] transition-all duration-300"
                  >
                    <social.icon size={16} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Accordion */}
        <div className="md:hidden py-6 border-b border-[#222]">
          <FooterAccordion title="Quick Links">
            <ul className="space-y-2 text-xs text-gray-400">
              <li><Link to="/" className="block py-1 hover:text-[#A11B35]">Home</Link></li>
              <li><Link to="/shop" className="block py-1 hover:text-[#A11B35]">Shop</Link></li>
              <li><Link to="/about" className="block py-1 hover:text-[#A11B35]">About Us</Link></li>
              <li><Link to="/contact" className="block py-1 hover:text-[#A11B35]">Contact Us</Link></li>
              <li><Link to="/track" className="block py-1 hover:text-[#A11B35]">Track Order</Link></li>
            </ul>
          </FooterAccordion>

          <FooterAccordion title="Policies">
            <ul className="space-y-2 text-xs text-gray-400">
              <li><Link to="/faq" className="block py-1 hover:text-[#A11B35]">FAQs & Help</Link></li>
              <li><Link to="/privacy-policy" className="block py-1 hover:text-[#A11B35]">Privacy Policy</Link></li>
              <li><Link to="/terms-of-service" className="block py-1 hover:text-[#A11B35]">Terms & Conditions</Link></li>
              <li><Link to="/return-policy" className="block py-1 hover:text-[#A11B35]">Return & Refund Policy</Link></li>
              <li><Link to="/shipping-policy" className="block py-1 hover:text-[#A11B35]">Shipping Policy</Link></li>
            </ul>
          </FooterAccordion>

          <FooterAccordion title="Categories">
            <ul className="space-y-2 text-xs text-gray-400">
              {['Kurti', 'Saree', 'Lehenga', 'Suit Sets', 'Western Wear'].map(cat => (
                <li key={cat}>
                  <Link to={`/shop?category=${encodeURIComponent(cat)}`} className="block py-1 hover:text-[#A11B35]">{cat}</Link>
                </li>
              ))}
            </ul>
          </FooterAccordion>

          <FooterAccordion title="Contact & Support">
            <div className="space-y-3 text-xs text-gray-400 pt-1">
              <p className="flex items-center gap-2">
                <Mail size={14} className="text-[#A11B35]" /> support@therubyfashion.shop
              </p>
              <p className="flex items-center gap-2">
                <Clock size={14} className="text-[#A11B35]" /> Mon-Sat: 10AM - 7PM
              </p>
              <p className="flex items-center gap-2">
                <MapPin size={14} className="text-[#A11B35]" /> Mumbai, India
              </p>
              <div className="pt-2 flex items-center gap-3">
                {socialLinks.map(social => (
                  <a
                    key={social.id}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.name}
                    className="w-9 h-9 bg-[#181818] border border-[#2a2a2a] rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#A11B35] transition-all"
                  >
                    <social.icon size={16} />
                  </a>
                ))}
              </div>
            </div>
          </FooterAccordion>
        </div>

        {/* 3. PAYMENT METHODS SECTION */}
        <div className="py-8 border-b border-[#222] flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 shrink-0">
              We Accept
            </span>
            <div className="flex items-center gap-3 justify-center w-full sm:w-auto">
              {/* UPI */}
              <div className="bg-white border border-white px-3 py-1.5 rounded-lg flex items-center justify-center h-10 w-36 shadow-xs hover:scale-[1.02] transition-transform cursor-pointer shrink-0">
                <img 
                  src="https://www.vectorlogo.zone/logos/upi/upi-ar21.svg" 
                  alt="UPI" 
                  className="h-5 w-auto object-contain" 
                />
              </div>

              {/* Cash On Delivery */}
              <div className="bg-[#181818] border border-[#2a2a2a] px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 h-10 w-36 hover:border-[#A11B35]/50 transition-colors cursor-pointer shrink-0">
                <HandCoins size={15} className="text-[#A11B35] shrink-0" />
                <span className="text-[11px] font-bold text-white uppercase tracking-wider whitespace-nowrap">Cash On Delivery</span>
              </div>
            </div>
          </div>

          {/* Security Badge */}
          <div className="inline-flex items-center gap-2.5 bg-[#181818] border border-[#2a2a2a] px-4 py-2.5 rounded-full text-xs text-gray-300 font-medium">
            <ShieldCheck size={16} className="text-[#A11B35]" />
            <span>100% Secure Payments | SSL Encrypted</span>
          </div>
        </div>

        {/* 4. BOTTOM BAR */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <p>© 2026 The Ruby Fashion. All rights reserved.</p>
          <p className="flex items-center gap-1 font-medium">
            Made with <span className="text-[#A11B35]">❤️</span> in India 🇮🇳
          </p>
        </div>

      </div>

      {/* Back To Top Floating Button */}
      <motion.button 
        whileHover={{ scale: 1.1, y: -3 }}
        whileTap={{ scale: 0.95 }}
        onClick={scrollToTop}
        aria-label="Scroll to top"
        className="fixed bottom-6 right-6 w-11 h-11 bg-[#181818] border border-[#333] hover:border-[#A11B35] rounded-full flex items-center justify-center text-gray-300 hover:text-[#A11B35] transition-all shadow-xl z-30 cursor-pointer"
      >
        <ArrowUp size={18} />
      </motion.button>
    </footer>
  );
}

