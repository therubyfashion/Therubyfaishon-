import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { 
  User, 
  ShoppingBag, 
  Heart, 
  Settings, 
  LogOut, 
  ChevronRight, 
  Shield, 
  ShieldCheck,
  Mail, 
  Phone,
  Calendar,
  Sparkles,
  MessageCircle
} from 'lucide-react';
import { collection } from 'firebase/firestore';
import { db } from '../firebase';

import PhoneVerification from '../components/PhoneVerification';
import { AnimatePresence } from 'motion/react';

export default function Profile() {
  const { user, profile, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [showPhoneVerify, setShowPhoneVerify] = React.useState(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out successfully!");
      navigate('/');
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout.");
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#FAFAFA] pt-20 pb-24">
        <div className="text-center space-y-8 max-w-sm w-full">
          <div className="w-24 h-24 bg-ruby/10 text-ruby rounded-[2rem] flex items-center justify-center mx-auto mb-6">
            <User size={48} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-serif font-bold text-[#1A2C54]">Your <span className="text-ruby italic">Profile</span></h1>
            <p className="text-sm text-gray-400 font-medium">Sign in to track your orders, manage your wishlist, and more.</p>
          </div>
          <div className="flex flex-col gap-4">
            <Link 
              to="/login" 
              className="w-full bg-[#1A2C54] text-white py-4 rounded-2xl text-sm font-bold uppercase tracking-[0.2em] hover:bg-ruby transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-[#1A2C54]/10"
            >
              Sign In
            </Link>
            <Link 
              to="/signup" 
              className="w-full bg-white border border-gray-100 text-[#1A2C54] py-4 rounded-2xl text-sm font-bold uppercase tracking-[0.2em] hover:border-ruby/30 hover:bg-ruby/5 transition-all"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const menuItems = [
    { icon: ShoppingBag, label: 'My Orders', path: '/my-orders', color: 'text-blue-500', bg: 'bg-blue-50' },
    { icon: Heart, label: 'Wishlist', path: '/wishlist', color: 'text-ruby', bg: 'bg-ruby/5' },
    { icon: MessageCircle, label: 'Chat with Support', onClick: () => window.dispatchEvent(new CustomEvent('open-ruby-chat')), color: 'text-ruby', bg: 'bg-ruby/5' },
    { icon: Settings, label: 'Settings', path: '/settings', color: 'text-gray-500', bg: 'bg-gray-50' },
  ];

  if (isAdmin) {
    menuItems.unshift({ icon: Shield, label: 'Admin Dashboard', path: '/admin', color: 'text-purple-500', bg: 'bg-purple-50' });
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] pt-24 pb-24 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Profile Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-[2.5rem] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.08)] border border-gray-50 flex flex-col items-center text-center space-y-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-ruby/5 rounded-full blur-3xl -mr-16 -mt-16" />
          
          <div className="relative">
            <div className="w-24 h-24 rounded-[2rem] bg-ruby/10 flex items-center justify-center text-ruby ring-4 ring-white shadow-lg">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover rounded-[2rem]" referrerPolicy="no-referrer" />
              ) : (
                <User size={40} />
              )}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-xl shadow-md border border-gray-50">
              <Sparkles size={16} className="text-ruby" />
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-serif font-bold text-[#1A2C54]">{user.displayName || 'The Ruby User'}</h2>
            <p className="text-sm text-gray-400 font-medium">{user.email}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full pt-4">
            <div className="bg-gray-50 p-4 rounded-2xl space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Member Since</p>
              <p className="text-xs font-bold text-[#1A2C54]">
                {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Recently'}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Account Type</p>
              <p className="text-xs font-bold text-ruby uppercase tracking-widest">{profile?.role || 'User'}</p>
            </div>
          </div>
        </motion.div>

        {/* Contact Info */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 px-2">Contact Information</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-gray-400 shadow-sm">
                <Mail size={18} />
              </div>
              <div className="flex-grow min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Email Address</p>
                <p className="text-sm font-bold text-[#1A2C54] truncate">{user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl group transition-all">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-gray-400 shadow-sm group-hover:text-ruby transition-colors">
                <Phone size={18} />
              </div>
              <div className="flex-grow min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Phone Number</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-[#1A2C54] truncate">
                    {profile?.phoneNumber ? `+91 ${profile.phoneNumber}` : 'Not Verified'}
                  </p>
                  {!profile?.phoneNumber ? (
                    <button 
                      onClick={() => setShowPhoneVerify(true)}
                      className="text-[10px] font-bold text-ruby uppercase tracking-widest hover:underline"
                    >
                      Verify Now
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 text-green-500">
                      <ShieldCheck size={12} />
                      <span className="text-[8px] font-bold uppercase tracking-widest">Verified</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showPhoneVerify && (
            <PhoneVerification 
              onClose={() => setShowPhoneVerify(false)}
              onSuccess={() => {
                setShowPhoneVerify(false);
                window.location.reload(); // Refresh to update profile state
              }}
            />
          )}
        </AnimatePresence>

        {/* Menu Items */}
        <div className="bg-white overflow-hidden rounded-[2rem] shadow-sm border border-gray-50 divide-y divide-gray-50">
          {menuItems.map((item, idx) => (
            item.path ? (
              <Link 
                key={idx} 
                to={item.path}
                className="flex items-center justify-between p-6 hover:bg-gray-50 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl ${item.bg} ${item.color} flex items-center justify-center transition-transform group-hover:scale-110`}>
                    <item.icon size={22} />
                  </div>
                  <span className="text-sm font-bold text-[#1A2C54] uppercase tracking-widest">{item.label}</span>
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-ruby group-hover:translate-x-1 transition-all" />
              </Link>
            ) : (
              <button 
                key={idx} 
                onClick={item.onClick}
                className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl ${item.bg} ${item.color} flex items-center justify-center transition-transform group-hover:scale-110`}>
                    <item.icon size={22} />
                  </div>
                  <span className="text-sm font-bold text-[#1A2C54] uppercase tracking-widest">{item.label}</span>
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-ruby group-hover:translate-x-1 transition-all" />
              </button>
            )
          ))}
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-between p-6 hover:bg-ruby/5 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-ruby/10 text-ruby flex items-center justify-center transition-transform group-hover:scale-110">
                <LogOut size={22} />
              </div>
              <span className="text-sm font-bold text-ruby uppercase tracking-widest">Logout</span>
            </div>
            <ChevronRight size={18} className="text-ruby/30 group-hover:translate-x-1 transition-all" />
          </button>
        </div>

        <p className="text-[10px] text-center text-gray-300 uppercase tracking-[0.3em] font-bold pt-4">
          The Ruby Premium Experience
        </p>
      </div>
    </div>
  );
}
