import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingBag, User, Menu, X, Search, Heart, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';
import { auth, db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

export default function Navbar() {
  const { user, isAdmin } = useAuth();
  const { itemCount } = useCart();
  const { items: wishlistItems } = useWishlist();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [storeSettings, setStoreSettings] = React.useState<any>(null);

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    
    const fetchSettings = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'settings'));
        if (!querySnapshot.empty) {
          setStoreSettings(querySnapshot.docs[0].data());
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Shop', path: '/shop' },
    { name: 'About', path: '/about' },
    { name: 'FAQ', path: '/faq' },
  ];

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled 
          ? 'bg-white/80 backdrop-blur-lg shadow-sm py-3' 
          : 'bg-transparent py-6'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Mobile Menu Button */}
          <div className="flex md:hidden">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`${isScrolled ? 'text-gray-900' : 'text-white'} p-2`}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            {storeSettings?.storeLogo ? (
              <img 
                src={storeSettings.storeLogo} 
                alt="Logo" 
                className="h-10 w-auto object-contain transition-transform group-hover:scale-110" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className={`w-10 h-10 rounded-xl bg-ruby flex items-center justify-center text-white font-serif text-xl font-bold shadow-lg shadow-ruby/20 group-hover:rotate-12 transition-transform`}>
                R
              </div>
            )}
            <span className={`text-xl font-serif font-bold tracking-tighter ${
              isScrolled ? 'text-gray-900' : 'text-white'
            }`}>
              {storeSettings?.storeName || 'The Ruby'}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-10">
            {navLinks.map((link) => (
              <Link 
                key={link.name}
                to={link.path}
                className={`text-[10px] font-bold uppercase tracking-[0.2em] transition-all hover:text-ruby relative group ${
                  isScrolled ? 'text-gray-600' : 'text-white/80'
                }`}
              >
                {link.name}
                <span className={`absolute -bottom-1 left-0 w-0 h-0.5 bg-ruby transition-all group-hover:w-full ${
                  location.pathname === link.path ? 'w-full' : ''
                }`}></span>
              </Link>
            ))}
          </div>

          {/* Icons */}
          <div className="flex items-center space-x-2 md:space-x-6">
            <Link to="/search" className={`p-2 transition-colors ${isScrolled ? 'text-gray-600 hover:text-ruby' : 'text-white/80 hover:text-white'}`}>
              <Search size={20} />
            </Link>
            
            <Link to="/wishlist" className={`p-2 transition-colors relative group ${isScrolled ? 'text-gray-600 hover:text-ruby' : 'text-white/80 hover:text-white'}`}>
              <Heart size={20} />
              {wishlistItems.length > 0 && (
                <span className="absolute top-0 right-0 bg-ruby text-white text-[8px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
                  {wishlistItems.length}
                </span>
              )}
            </Link>

            <Link to="/cart" className={`p-2 transition-colors relative group ${isScrolled ? 'text-gray-600 hover:text-ruby' : 'text-white/80 hover:text-white'}`}>
              <ShoppingBag size={20} />
              {itemCount > 0 && (
                <span className="absolute top-0 right-0 bg-ruby text-white text-[8px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
                  {itemCount}
                </span>
              )}
            </Link>

            <div className="h-4 w-px bg-gray-200 hidden md:block"></div>

            {user ? (
              <div className="flex items-center space-x-4">
                {isAdmin && (
                  <Link to="/admin" className={`p-2 transition-colors ${isScrolled ? 'text-gray-600 hover:text-ruby' : 'text-white/80 hover:text-white'}`}>
                    <Settings size={20} className="animate-spin-slow" />
                  </Link>
                )}
                <Link to="/profile" className="w-8 h-8 rounded-full bg-ruby/10 border border-ruby/20 flex items-center justify-center overflow-hidden">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User size={16} className="text-ruby" />
                  )}
                </Link>
              </div>
            ) : (
              <Link 
                to="/login" 
                className={`text-[10px] font-bold uppercase tracking-widest px-6 py-2.5 rounded-full transition-all ${
                  isScrolled 
                    ? 'bg-black text-white hover:bg-ruby' 
                    : 'bg-white text-black hover:bg-ruby hover:text-white'
                }`}
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-[80%] max-w-sm bg-white z-50 md:hidden p-8 flex flex-col"
            >
              <div className="flex justify-between items-center mb-12">
                <span className="text-2xl font-serif font-bold text-ruby">The Ruby</span>
                <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-gray-50 rounded-full">
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex flex-col space-y-6">
                {navLinks.map((link) => (
                  <Link 
                    key={link.name}
                    to={link.path}
                    onClick={() => setIsMenuOpen(false)}
                    className="text-xl font-serif font-bold text-gray-900 hover:text-ruby transition-colors"
                  >
                    {link.name}
                  </Link>
                ))}
              </div>

              <div className="mt-auto pt-8 border-t border-gray-100">
                {user ? (
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden">
                      {user.photoURL && <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{user.displayName || 'User'}</p>
                      <Link to="/profile" onClick={() => setIsMenuOpen(false)} className="text-xs text-ruby font-bold uppercase tracking-widest">View Profile</Link>
                    </div>
                  </div>
                ) : (
                  <Link 
                    to="/login" 
                    onClick={() => setIsMenuOpen(false)}
                    className="block w-full bg-ruby text-white text-center py-4 rounded-2xl font-bold uppercase tracking-widest"
                  >
                    Login / Sign Up
                  </Link>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
