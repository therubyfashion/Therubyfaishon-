import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Facebook, Twitter, Mail, MapPin, Phone, Youtube } from 'lucide-react';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../firebase';

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

  return (
    <footer className="bg-[#0A0A0A] text-white pt-20 pb-10 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:justify-between gap-12 mb-16">
          {/* Logo & Tagline */}
          <div className="max-w-xs space-y-6">
            <Link to="/" className="block">
              {settings?.storeLogo ? (
                <img src={settings.storeLogo} alt={settings.storeName} className="h-10 object-contain brightness-0 invert" />
              ) : (
                <span className="text-3xl font-serif font-bold tracking-tighter text-white">
                  {settings?.storeName || 'The Ruby'}
                </span>
              )}
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed font-medium">
              India's premier destination for women's fashion. Curated style, delivered with love.
            </p>
            <div className="flex space-x-5 pt-2">
              {settings?.footerSocials?.instagram && (
                <a href={settings.footerSocials.instagram} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-ruby transition-colors">
                  <Instagram size={20} />
                </a>
              )}
              {settings?.footerSocials?.facebook && (
                <a href={settings.footerSocials.facebook} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-ruby transition-colors">
                  <Facebook size={20} />
                </a>
              )}
              {settings?.footerSocials?.x && (
                <a href={settings.footerSocials.x} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-ruby transition-colors">
                  <Twitter size={20} />
                </a>
              )}
              {settings?.footerSocials?.youtube && (
                <a href={settings.footerSocials.youtube} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-ruby transition-colors">
                  <Youtube size={20} />
                </a>
              )}
            </div>
          </div>

          {/* Footer Columns */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-10 lg:gap-16 flex-grow">
            {/* Shop */}
            <div className="space-y-6">
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">Shop</h4>
              <ul className="space-y-4">
                <li><Link to="/shop?category=New Arrivals" className="text-sm text-gray-400 hover:text-ruby transition-colors font-medium">New Arrivals</Link></li>
                <li><Link to="/shop?category=Dresses" className="text-sm text-gray-400 hover:text-ruby transition-colors font-medium">Dresses</Link></li>
                <li><Link to="/shop?category=Sarees" className="text-sm text-gray-400 hover:text-ruby transition-colors font-medium">Sarees</Link></li>
                <li><Link to="/shop?category=Sale" className="text-sm text-gray-400 hover:text-ruby transition-colors font-medium">Sale</Link></li>
              </ul>
            </div>

            {/* Help */}
            <div className="space-y-6">
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">Help</h4>
              <ul className="space-y-4">
                <li><Link to="/my-orders" className="text-sm text-gray-400 hover:text-ruby transition-colors font-medium">Track Order</Link></li>
                <li><Link to="/returns" className="text-sm text-gray-400 hover:text-ruby transition-colors font-medium">Returns</Link></li>
                <li><Link to="/size-guide" className="text-sm text-gray-400 hover:text-ruby transition-colors font-medium">Size Guide</Link></li>
                <li><Link to="/contact" className="text-sm text-gray-400 hover:text-ruby transition-colors font-medium">Contact Us</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div className="space-y-6">
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">Company</h4>
              <ul className="space-y-4">
                <li><Link to="/about" className="text-sm text-gray-400 hover:text-ruby transition-colors font-medium">About Us</Link></li>
                <li><Link to="/careers" className="text-sm text-gray-400 hover:text-ruby transition-colors font-medium">Careers</Link></li>
                <li><Link to="/blog" className="text-sm text-gray-400 hover:text-ruby transition-colors font-medium">Blog</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div className="space-y-6">
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">Legal</h4>
              <ul className="space-y-4">
                <li><Link to="/privacy" className="text-sm text-gray-400 hover:text-ruby transition-colors font-medium">Privacy Policy</Link></li>
                <li><Link to="/terms" className="text-sm text-gray-400 hover:text-ruby transition-colors font-medium">Terms & Conditions</Link></li>
                <li><Link to="/refund" className="text-sm text-gray-400 hover:text-ruby transition-colors font-medium">Refund Policy</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="h-px bg-white/5 w-full mb-10" />

        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
            © {new Date().getFullYear()} THE RUBY
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-lg">
              <span>🔒</span> SSL SECURE
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-lg">
              <span>💳</span> RAZORPAY
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-lg">
              <span>📦</span> PAN-INDIA
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
