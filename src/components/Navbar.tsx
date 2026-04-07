import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, User, LogOut, Menu, X, Search, Heart, Package } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';
import { auth, db } from '../firebase';
import { cn } from '../lib/utils';
import { collection, getDocs } from 'firebase/firestore';

export default function Navbar() {
  const { user, isAdmin } = useAuth();
  const { itemCount } = useCart();
  const { items: wishlistItems } = useWishlist();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [storeSettings, setStoreSettings] = React.useState<any>(null);

  React.useEffect(() => {
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
  }, []);

  React.useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMenuOpen]);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          {/* Mobile Menu Button */}
          <div className="flex items-center md:hidden">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2">
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            {storeSettings?.storeLogo ? (
              <img src={storeSettings.storeLogo} alt={storeSettings.storeName} className="h-8 md:h-10 object-contain" />
            ) : (
              <span className="text-3xl font-serif font-bold tracking-tighter">
                {storeSettings?.storeName || 'The Ruby'}
              </span>
            )}
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8 text-sm font-medium uppercase tracking-widest">
            <Link to="/shop" className="hover:text-ruby transition-colors">Shop</Link>
            <Link to="/shop?category=Women" className="hover:text-ruby transition-colors">Women</Link>
            <Link to="/shop?category=Men" className="hover:text-ruby transition-colors">Men</Link>
            <Link to="/about" className="hover:text-ruby transition-colors">About</Link>
          </div>

          {/* Icons */}
          <div className="flex items-center space-x-5">
            <Link to="/search" className="p-2 hover:text-ruby transition-colors">
              <Search size={20} />
            </Link>
            
            <Link to="/wishlist" className="p-2 hover:text-ruby transition-colors relative">
              <Heart size={20} />
              {wishlistItems.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-ruby text-white text-[8px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                  {wishlistItems.length}
                </span>
              )}
            </Link>

            <Link to="/profile" className="p-2 hover:text-ruby transition-colors">
              <User size={20} />
            </Link>

            <Link to="/cart" className="p-2 hover:text-ruby transition-colors relative">
              <ShoppingBag size={20} />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-ruby text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-100 py-4 px-4 space-y-4">
          <Link to="/shop" className="block text-lg font-medium" onClick={() => setIsMenuOpen(false)}>Shop All</Link>
          <Link to="/shop?category=Women" className="block text-lg font-medium" onClick={() => setIsMenuOpen(false)}>Women</Link>
          <Link to="/shop?category=Men" className="block text-lg font-medium" onClick={() => setIsMenuOpen(false)}>Men</Link>
          <Link to="/about" className="block text-lg font-medium" onClick={() => setIsMenuOpen(false)}>About Us</Link>
          {user && (
            <Link to="/my-orders" className="block text-lg font-medium" onClick={() => setIsMenuOpen(false)}>My Orders</Link>
          )}
        </div>
      )}
    </nav>
  );
}
