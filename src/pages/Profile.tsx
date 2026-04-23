import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { db, auth, storage } from '../firebase';
import { signOut, updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { 
  Pencil,
  Camera,
  X,
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
  MessageCircle,
  MapPin
} from 'lucide-react';
import { collection, doc, updateDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';

import PhoneVerification from '../components/PhoneVerification';
import { AnimatePresence } from 'motion/react';

export default function Profile() {
  const { user, profile, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [showPhoneVerify, setShowPhoneVerify] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [editForm, setEditForm] = React.useState({
    displayName: '',
    photoURL: '',
    phoneNumber: '',
    email: ''
  });

  React.useEffect(() => {
    if (user && profile) {
      setEditForm({
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        phoneNumber: profile.phoneNumber || '',
        email: user.email || ''
      });
    }
  }, [user, profile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      // Update Firebase Auth (Display Name & Photo)
      await updateProfile(user, {
        displayName: editForm.displayName,
        photoURL: editForm.photoURL
      });

      // Update Firestore (Name, Phone, Email)
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: editForm.displayName,
        phoneNumber: editForm.phoneNumber,
        email: editForm.email
      });

      toast.success("Profile updated successfully!");
      setIsEditing(false);
    } catch (error) {
      console.error("Update profile error:", error);
      toast.error("Failed to update profile.");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file.");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB.");
      return;
    }

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `profiles/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      setEditForm(prev => ({ ...prev, photoURL: downloadURL }));
      toast.success("Image uploaded! Click Save to apply.");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('phone_user');
      toast.success("Logged out successfully!");
      navigate('/');
      window.location.reload();
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
    { icon: MapPin, label: 'Saved Addresses', path: '/addresses', color: 'text-green-500', bg: 'bg-green-50' },
    { icon: Heart, label: 'Wishlist', path: '/wishlist', color: 'text-ruby', bg: 'bg-ruby/5' },
    { icon: MessageCircle, label: 'Chat with Support', onClick: () => window.dispatchEvent(new CustomEvent('open-ruby-chat')), color: 'text-ruby', bg: 'bg-ruby/5' },
    { icon: Settings, label: 'Settings', path: '/settings', color: 'text-gray-500', bg: 'bg-gray-50' },
  ];

  if (isAdmin) {
    menuItems.unshift({ icon: Shield, label: 'Admin Dashboard', path: '/admin', color: 'text-purple-500', bg: 'bg-purple-50' });
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] pt-12 pb-24 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Page Title */}
        <div className="flex items-center justify-between px-2">
          <h1 className="text-3xl font-serif font-bold text-[#1A2C54]">Profile</h1>
          <div className="h-1 w-12 bg-ruby rounded-full" />
        </div>

        {/* Profile Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-[2.5rem] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.08)] border border-gray-50 flex flex-col items-center text-center space-y-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-ruby/5 rounded-full blur-3xl -mr-16 -mt-16" />
          
          <div className="relative group">
            <div className="w-24 h-24 rounded-[2rem] bg-ruby/10 flex items-center justify-center text-ruby ring-4 ring-white shadow-lg overflow-hidden">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User size={40} />
              )}
            </div>
            <button 
              onClick={() => setIsEditing(true)}
              className="absolute -bottom-2 -right-2 bg-white p-2.5 rounded-xl shadow-md border border-gray-50 text-ruby hover:scale-110 transition-transform active:scale-95"
            >
              <Pencil size={16} />
            </button>
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

        {/* Edit Profile Modal */}
        <AnimatePresence>
          {isEditing && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsEditing(false)}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative z-10 space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-serif font-bold text-[#1A2C54]">Edit Profile</h3>
                  <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
                    <X size={20} className="text-gray-400" />
                  </button>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2">Profile Picture</label>
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                      <div className="w-16 h-16 rounded-xl bg-white flex items-center justify-center overflow-hidden border border-gray-100 shadow-sm">
                        {editForm.photoURL ? (
                          <img src={editForm.photoURL} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <User size={24} className="text-gray-300" />
                        )}
                      </div>
                      <div className="flex-grow">
                        <input 
                          type="file" 
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept="image/*"
                          className="hidden"
                        />
                        <button 
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          className="w-full bg-white border border-gray-100 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest text-[#1A2C54] hover:border-ruby/30 hover:text-ruby transition-all flex items-center justify-center gap-2"
                        >
                          <Camera size={14} />
                          {isUploading ? 'Uploading...' : 'Choose from Gallery'}
                        </button>
                        <p className="text-[8px] text-gray-400 mt-2 px-1 font-medium italic">Max size 2MB. JPG, PNG supported.</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="text"
                        value={editForm.displayName}
                        onChange={(e) => setEditForm({...editForm, displayName: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-[#1A2C54] focus:ring-2 focus:ring-ruby/20"
                        placeholder="Your Name"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-[#1A2C54] focus:ring-2 focus:ring-ruby/20"
                        placeholder="example@gmail.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="tel"
                        value={editForm.phoneNumber}
                        onChange={(e) => setEditForm({...editForm, phoneNumber: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-[#1A2C54] focus:ring-2 focus:ring-ruby/20"
                        placeholder="9876543210"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-[#1A2C54] text-white py-4 rounded-2xl text-sm font-bold uppercase tracking-[0.2em] hover:bg-ruby transition-all shadow-lg shadow-[#1A2C54]/20 pt-4"
                  >
                    Save Changes
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div className="space-y-8">
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
                    {!profile?.phoneVerified ? (
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

          {/* Menu Items */}
          <div className="bg-white overflow-hidden rounded-[2rem] shadow-sm border border-gray-50 divide-y divide-gray-50">
            {menuItems.map((item, idx) => (
              <React.Fragment key={idx}>
                {item.path ? (
                  <Link 
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
                )}
              </React.Fragment>
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
        </div>

        <p className="text-[10px] text-center text-gray-300 uppercase tracking-[0.3em] font-bold pt-4">
          The Ruby Premium Experience
        </p>
      </div>
    </div>
  );
}
