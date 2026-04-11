import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Facebook, Twitter, Mail, MapPin, Phone, Youtube, MessageCircle, Sparkles, ArrowUpRight } from 'lucide-react';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'motion/react';

export default function Footer() {
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const q = query(collection(db, 'settings'), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          setSettings(querySnapshot.docs[0].data());
        }
      } catch (error) {
        console.error("Error fetching footer settings:", error);
      }
    };
    fetchSettings();
  }, []);

  const socialLinks = [
    { id: 'instagram', icon: Instagram, url: settings?.footerSocials?.instagram, color: 'hover:text-pink-500 hover:bg-pink-500/10' },
    { id: 'facebook', icon: Facebook, url: settings?.footerSocials?.facebook, color: 'hover:text-blue-600 hover:bg-blue-600/10' },
    { id: 'whatsapp', icon: MessageCircle, url: settings?.footerSocials?.whatsapp ? `https://wa.me/${settings.footerSocials.whatsapp}` : null, color: 'hover:text-green-500 hover:bg-green-500/10' },
    { id: 'youtube', icon: Youtube, url: settings?.footerSocials?.youtube, color: 'hover:text-red-600 hover:bg-red-600/10' },
    { id: 'x', icon: Twitter, url: settings?.footerSocials?.x, color: 'hover:text-white hover:bg-white/10' },
  ].filter(link => link.url);

  return (
    <footer className="bg-[#0A0A0A] text-white pt-24 pb-12 border-t border-white/5 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-ruby/5 rounded-full blur-[120px] -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-ruby/5 rounded-full blur-[120px] translate-y-1/2 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 mb-20">
          {/* Logo & Brand Info */}
          <div className="lg:col-span-4 space-y-8">
            <Link to="/" className="inline-block group">
              {settings?.storeLogo ? (
                <img src={settings.storeLogo} alt={settings.storeName} className="h-12 object-contain brightness-0 invert transition-transform duration-500 group-hover:scale-110" />
              ) : (
                <div className="flex flex-col">
                  <span className="text-4xl font-serif font-bold tracking-tighter transition-colors">
                    <span className="text-white">The</span> <span className="text-ruby">Ruby</span>
                  </span>
                  <div className="h-1 w-12 bg-ruby mt-1 rounded-full transform origin-left transition-all duration-500 group-hover:w-full" />
                </div>
              )}
            </Link>
            
            <p className="text-gray-400 text-base leading-relaxed font-medium max-w-sm">
              {settings?.storeDescription || "India's premier destination for women's fashion. Curated style, delivered with love and premium craftsmanship."}
            </p>

            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Connect With Us</h4>
              <div className="flex flex-wrap gap-3">
                {socialLinks.map((social) => (
                  <a 
                    key={social.id}
                    href={social.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={`w-11 h-11 flex items-center justify-center rounded-2xl bg-white/5 border border-white/5 text-gray-400 transition-all duration-300 group ${social.color}`}
                  >
                    <social.icon size={20} className="transition-transform group-hover:scale-110" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-10 lg:gap-12">
            <div className="space-y-7">
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-ruby flex items-center gap-2">
                <Sparkles size={12} />
                Shop
              </h4>
              <ul className="space-y-4">
                {['New Arrivals', 'Dresses', 'Sarees', 'Sale'].map((item) => (
                  <li key={item}>
                    <Link to={`/shop?category=${item}`} className="text-sm text-gray-400 hover:text-white transition-all hover:translate-x-1 inline-flex items-center group font-medium">
                      {item}
                      <ArrowUpRight size={12} className="opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all ml-1" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-7">
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-ruby">Support</h4>
              <ul className="space-y-4">
                {[
                  { label: 'Track Order', path: '/my-orders' },
                  { label: 'Returns', path: '/returns' },
                  { label: 'Size Guide', path: '/size-guide' },
                  { label: 'Contact Us', path: '/contact' }
                ].map((item) => (
                  <li key={item.label}>
                    <Link to={item.path} className="text-sm text-gray-400 hover:text-white transition-all hover:translate-x-1 inline-block font-medium">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-7">
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-ruby">Company</h4>
              <ul className="space-y-4">
                {[
                  { label: 'About Us', path: '/about' },
                  { label: 'Careers', path: '/careers' },
                  { label: 'Blog', path: '/blog' }
                ].map((item) => (
                  <li key={item.label}>
                    <Link to={item.path} className="text-sm text-gray-400 hover:text-white transition-all hover:translate-x-1 inline-block font-medium">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-7">
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-ruby">Legal</h4>
              <ul className="space-y-4">
                {[
                  { label: 'Privacy Policy', path: '/privacy' },
                  { label: 'Terms & Conditions', path: '/terms' },
                  { label: 'Refund Policy', path: '/refund' }
                ].map((item) => (
                  <li key={item.label}>
                    <Link to={item.path} className="text-sm text-gray-400 hover:text-white transition-all hover:translate-x-1 inline-block font-medium">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent w-full mb-12" />

        <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center lg:items-start gap-2">
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.3em]">
              © {new Date().getFullYear()} {settings?.storeName?.toUpperCase() || 'THE RUBY'}
            </div>
            <p className="text-[10px] text-gray-600 font-medium">Crafted with passion for the modern woman.</p>
          </div>
          
          <div className="flex flex-wrap justify-center items-center gap-4">
            {[
              { icon: '🔒', label: 'SSL SECURE' },
              { icon: '💳', label: 'RAZORPAY' },
              { icon: '📦', label: 'PAN-INDIA' }
            ].map((badge) => (
              <div key={badge.label} className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-white/5 border border-white/5 px-4 py-2 rounded-xl hover:bg-white/10 transition-colors cursor-default">
                <span>{badge.icon}</span> {badge.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
