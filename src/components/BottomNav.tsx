import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Grid, Search, ShoppingBag, User } from 'lucide-react';
import { motion } from 'motion/react';
import { useCart } from '../contexts/CartContext';

export default function BottomNav() {
  const { items } = useCart();
  const location = useLocation();
  const cartCount = items.reduce((acc, item) => acc + item.quantity, 0);

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Grid, label: 'Shop', path: '/shop' },
    { icon: Search, label: 'Search', path: '/search' },
    { icon: ShoppingBag, label: 'Cart', path: '/cart', count: cartCount },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  // Don't show bottom nav on admin paths or auth pages if needed, 
  // but usually it's fine for user pages.
  const hideOnPaths = ['/login', '/signup', '/checkout'];
  if (hideOnPaths.includes(location.pathname) || location.pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-gray-100 z-50 pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                relative flex flex-col items-center justify-center w-full h-full transition-all duration-300
                ${isActive ? 'text-ruby' : 'text-gray-400'}
              `}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {item.count !== undefined && item.count > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-ruby text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full ring-2 ring-white">
                    {item.count}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="bottomNavIndicator"
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-ruby rounded-full"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${isActive ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}>
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
