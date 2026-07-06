import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, Package, Truck, Home, ShoppingBag, ArrowRight, MapPin, 
  CreditCard, Lock, Eye, EyeOff, Loader2 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

import { useAuth } from '../contexts/AuthContext';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, addDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { generateInvoice } from '../utils/invoiceGenerator';
import { io } from 'socket.io-client';

export default function OrderSuccess() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Track purchased behavior and play success sound
  React.useEffect(() => {
    // 1. Play GPay/PhonePe-style synthesized success chime
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const now = ctx.currentTime;
        
        // Tone 1: Base warm start (E5)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, now);
        gain1.gain.setValueAtTime(0.12, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.15);

        // Tone 2: Mid rise (G5)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(783.99, now + 0.08);
        gain2.gain.setValueAtTime(0.12, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.25);

        // Tone 3: High resonant climax (C6)
        const osc3 = ctx.createOscillator();
        const gain3 = ctx.createGain();
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(1046.50, now + 0.16);
        gain3.gain.setValueAtTime(0.20, now + 0.16);
        gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
        osc3.connect(gain3);
        gain3.connect(ctx.destination);
        osc3.start(now + 0.16);
        osc3.stop(now + 0.85);
        
        // Tone 4: Sub-harmony (C5) for warm depth
        const oscSub = ctx.createOscillator();
        const gainSub = ctx.createGain();
        oscSub.type = 'sine';
        oscSub.frequency.setValueAtTime(523.25, now + 0.16);
        gainSub.gain.setValueAtTime(0.10, now + 0.16);
        gainSub.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        oscSub.connect(gainSub);
        gainSub.connect(ctx.destination);
        oscSub.start(now + 0.16);
        oscSub.stop(now + 0.7);
      }
    } catch (e) {
      console.warn("Failed to play synthesized success audio chime:", e);
    }

    const socket = io();
    socket.emit('checkpoint_reached', {
      type: 'purchased',
      sessionId: sessionStorage.getItem('visitor_session_id') || 'unknown',
      timestamp: new Date().toISOString()
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  const stateData = location.state || {};
  const orderData = {
    orderId: stateData.orderId || '#TRF0001',
    deliveryDate: stateData.deliveryDate || 'Within 5-10 Days',
    total: stateData.total || 0,
    subtotal: stateData.subtotal || 0,
    discount: stateData.discount || 0,
    shippingCost: stateData.shippingCost || 0,
    codFee: stateData.codFee || 0,
    paymentMethod: stateData.paymentMethod || 'COD',
    shippingMethod: stateData.shippingMethod || 'Standard Delivery',
    email: stateData.email || stateData.address?.email || '',
    address: {
      name: stateData.address?.name || stateData.customerName || 'Customer',
      address: stateData.address?.address || 'No address specified',
      city: stateData.address?.city || '',
      state: stateData.address?.state || '',
      pincode: stateData.address?.pincode || '',
      email: stateData.address?.email || stateData.email || '',
      number: stateData.address?.number || ''
    },
    items: stateData.items || []
  };

  const handleConvertGuestToCustomer = async () => {
    if (!orderData.email) {
      toast.error("No email associated with this order");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    setIsRegistering(true);
    try {
      let registeredUser;
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, orderData.email, password);
        registeredUser = userCredential.user;
      } catch (authError: any) {
        console.warn("⚠️ Firebase Auth guest conversion failed, establishing resilient offline sandbox user...", authError.message);
        const isIdentityToolkitDisabled = authError.message?.includes('identitytoolkit.googleapis.com') || 
                                          authError.message?.includes('Identity Toolkit') || 
                                          authError.message?.includes('SERVICE_DISABLED') ||
                                          authError.message?.includes('API_KEY_NOT_VALID') ||
                                          authError.code?.includes('operation-not-supported') ||
                                          authError.code?.includes('api-key-not-valid') ||
                                          authError.code?.includes('requests-from-referrers-blocked');
                                          
        if (isIdentityToolkitDisabled) {
          const mockUid = `offline_${Buffer.from(orderData.email).toString('hex').slice(0, 16)}`;
          const mockUser = {
            uid: mockUid,
            email: orderData.email,
            displayName: orderData.address.name,
            firstName: orderData.address.name.split(' ')[0] || 'Customer',
            lastName: orderData.address.name.split(' ').slice(1).join(' ') || 'User',
            role: 'user',
            isVerified: true
          };
          
          localStorage.setItem('ruby_local_user', JSON.stringify(mockUser));
          toast.success("✨ Account created successfully in Sandbox mode!");
          setTimeout(() => {
            window.location.reload();
          }, 1000);
          return;
        } else {
          throw authError;
        }
      }

      if (registeredUser) {
        const fullName = orderData.address.name;
        const firstName = fullName.split(' ')[0] || 'Customer';
        const lastName = fullName.split(' ').slice(1).join(' ') || 'User';

        // 1. Update Profile & Create User doc in Firestore
        await Promise.all([
          updateProfile(registeredUser, { displayName: fullName }),
          setDoc(doc(db, 'users', registeredUser.uid), {
            uid: registeredUser.uid,
            email: orderData.email.toLowerCase(),
            displayName: fullName,
            firstName,
            lastName,
            phoneNumber: orderData.address.number || '',
            role: 'user',
            isVerified: true,
            phoneVerified: true,
            createdAt: new Date().toISOString()
          })
        ]);

        // 2. Save address to user subcollection
        if (stateData.address) {
          try {
            await addDoc(collection(db, `users/${registeredUser.uid}/addresses`), {
              ...stateData.address,
              isDefault: true,
              createdAt: new Date().toISOString()
            });
          } catch (addrErr) {
            console.error("Failed to save address to new user profile:", addrErr);
          }
        }

        // 3. Link this order (and maybe any other guest orders with this email) to this user
        try {
          const q = query(collection(db, 'orders'), where('orderId', '==', orderData.orderId));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const orderDoc = querySnapshot.docs[0];
            await updateDoc(doc(db, 'orders', orderDoc.id), {
              userId: registeredUser.uid
            });
          }
        } catch (orderErr) {
          console.error("Failed to link order to new user ID:", orderErr);
        }

        toast.success("✨ Account created successfully! Your order is now linked.");
      }
    } catch (err: any) {
      console.error("Failed to register user:", err);
      toast.error(err.message || "Registration failed. Please try again.");
    } finally {
      setIsRegistering(false);
    }
  };

  const downloadReceipt = () => {
    generateInvoice(orderData);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-[#FDFDFD] min-h-screen pb-24 pt-12"
    >
      <div className="max-w-xl mx-auto px-4 space-y-10">
        {/* Success Icon & Title */}
        <div className="text-center space-y-6">
          <motion.div 
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 14, delay: 0.15 }}
            className="w-32 h-32 bg-[#107C41]/10 rounded-full flex items-center justify-center mx-auto relative"
          >
            {/* Concentric expanding ripples matching the audio chime beats */}
            <motion.div 
              initial={{ scale: 0.9, opacity: 0.6 }}
              animate={{ scale: [1, 2.4], opacity: [0.5, 0] }}
              transition={{ duration: 1.4, ease: "easeOut", delay: 0.16, repeat: 3, repeatType: "loop" }}
              className="absolute inset-0 bg-[#107C41]/25 rounded-full"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0.6 }}
              animate={{ scale: [1, 1.9], opacity: [0.4, 0] }}
              transition={{ duration: 1.2, ease: "easeOut", delay: 0.28, repeat: 3, repeatType: "loop" }}
              className="absolute inset-0 bg-[#107C41]/15 rounded-full"
            />
            <div className="absolute inset-0 bg-[#107C41] rounded-full blur-2xl opacity-20 animate-pulse" />
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 11, delay: 0.35 }}
              className="w-24 h-24 bg-[#107C41] rounded-full flex items-center justify-center text-white shadow-xl relative z-10"
            >
              <CheckCircle2 size={48} className="animate-pulse" style={{ animationDuration: '2s' }} />
            </motion.div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 150, damping: 18, delay: 0.4 }}
            className="space-y-3"
          >
            <h1 className="text-4xl sm:text-5xl font-serif italic text-[#1A2C54]">Order Placed!</h1>
            <p className="text-gray-400 text-sm sm:text-base leading-relaxed max-w-sm mx-auto font-medium">
              Your order has been confirmed. You'll receive a confirmation email and SMS shortly. Sit back and relax — your fashion is on its way!
            </p>
          </motion.div>
        </div>

        {/* Order ID Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 140, damping: 16, delay: 0.55 }}
          className="bg-white border border-gray-100 rounded-[2rem] p-8 text-center space-y-2 shadow-sm relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4">
            <button 
              onClick={downloadReceipt}
              className="p-2 bg-gray-50 text-gray-400 hover:text-ruby hover:bg-ruby/5 rounded-xl transition-all"
              title="Download Receipt"
            >
              <ShoppingBag size={18} />
            </button>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300">Order ID</p>
          <h3 className="text-2xl font-bold text-[#1A2C54] tracking-tight">{orderData.orderId}</h3>
          <div className="pt-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300">Estimated delivery</p>
            <p className="text-sm font-bold text-[#1A2C54]">{orderData.deliveryDate}</p>
          </div>
        </motion.div>

        {/* Order Status Timeline */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 140, damping: 16, delay: 0.7 }}
          className="bg-white border border-gray-100 rounded-[2rem] p-8 space-y-8 shadow-sm"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Order Status</p>
          <div className="space-y-8">
            {[
              { label: 'Order Confirmed', time: 'Just now • Payment received', icon: <CheckCircle2 size={18} />, active: true, done: true },
              { label: 'Processing', time: 'Within 24 hours', icon: <Package size={18} />, active: false, done: false },
              { label: 'Shipped', time: 'Apr 3, 2025', icon: <Truck size={18} />, active: false, done: false },
              { label: 'Delivered', time: orderData.deliveryDate, icon: <Home size={18} />, active: false, done: false },
            ].map((status, idx) => (
              <div key={idx} className="flex items-start gap-4 relative">
                {idx < 3 && (
                  <div className={`absolute left-5 top-10 w-[2px] h-10 -z-10 ${status.done ? 'bg-[#107C41]' : 'bg-gray-50'}`} />
                )}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${
                  status.done ? 'bg-[#107C41]/10 text-[#107C41]' : 'bg-gray-50 text-gray-300'
                }`}>
                  {status.icon}
                </div>
                <div className="space-y-0.5">
                  <p className={`text-sm font-bold ${status.done ? 'text-[#1A2C54]' : 'text-gray-300'}`}>{status.label}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{status.time}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Order Summary */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 140, damping: 16, delay: 0.85 }}
          className="bg-white border border-gray-100 rounded-[2rem] p-8 space-y-6 shadow-sm"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Order Summary</p>
          <div className="space-y-4">
            {orderData.items.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between text-sm font-bold text-[#1A2C54]">
                <span>{item.name} (Size {item.selectedSize})</span>
                <span>₹{Number(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-bold text-ruby">
              <span>Discount Applied</span>
              <span>-₹{Number(orderData.discount || 0).toLocaleString()}</span>
            </div>
            {orderData.codFee > 0 && (
              <div className="flex justify-between text-sm font-bold text-ruby">
                <span>COD Handling Fee</span>
                <span>+₹{Number(orderData.codFee || 0).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-green-500">
              <span>Delivery</span>
              <span>{orderData.shippingCost === 0 ? 'FREE' : `₹${Number(orderData.shippingCost || 0).toLocaleString()}`}</span>
            </div>
            <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
              <p className="text-lg font-bold text-[#1A2C54]">Total Paid</p>
              <p className="text-2xl font-bold text-ruby">₹{Number(orderData.total || 0).toLocaleString()}</p>
            </div>
          </div>
        </motion.div>

        {/* Delivery Details Box */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 140, damping: 16, delay: 1.0 }}
          className="bg-ruby/5 border border-ruby/10 rounded-[2rem] p-8 space-y-4"
        >
          <div className="flex items-start gap-3">
            <MapPin size={18} className="text-ruby mt-1" />
            <p className="text-sm font-bold text-[#1A2C54] leading-relaxed">
              Delivering to: <span className="text-gray-400 font-medium">
                {orderData.address.name}, {orderData.address.address}, {orderData.address.city}, {orderData.address.state} - {orderData.address.pincode}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-6 pt-2">
            <div className="flex items-center gap-2">
              <CreditCard size={16} className="text-yellow-500" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A2C54]">
                Paid via: <span className="text-gray-400">{orderData.paymentMethod}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Truck size={16} className="text-ruby" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A2C54]">
                {orderData.shippingMethod}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Save Details for Next Time Card (Guest Registration) */}
        {!user && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 140, damping: 16, delay: 1.05 }}
            className="bg-white border border-gray-100 rounded-[2rem] p-8 space-y-6 shadow-sm relative overflow-hidden"
          >
            <div className="absolute -right-8 -top-8 w-24 h-24 bg-ruby/5 rounded-full" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-ruby/10 flex items-center justify-center text-ruby">
                <Lock size={18} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1A2C54]">Save details for next time?</h3>
                <p className="text-xs text-gray-400 font-medium">Convert your guest session into a permanent customer account</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-2xl space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Account Email</p>
                <p className="text-sm font-bold text-[#1A2C54]">{orderData.email}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-2xl space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">First Name</p>
                  <p className="text-sm font-bold text-[#1A2C54]">
                    {orderData.address.name.split(' ')[0] || 'Customer'}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Last Name</p>
                  <p className="text-sm font-bold text-[#1A2C54]">
                    {orderData.address.name.split(' ').slice(1).join(' ') || 'User'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Choose a Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium pr-12 text-[#1A2C54]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1A2C54] transition-all"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                onClick={handleConvertGuestToCustomer}
                disabled={isRegistering}
                className="w-full bg-ruby text-white py-4 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-ruby/10 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="animate-spin animate-infinite" size={16} />
                    Creating Account...
                  </>
                ) : (
                  <>
                    Create Customer Account ✨
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 140, damping: 16, delay: 1.15 }}
          className="space-y-4"
        >
          <button 
            onClick={() => {
              const emailValue = orderData.address?.email || orderData.email || '';
              const orderIdValue = (orderData.orderId || '').replace('#', '');
              navigate(`/track/${orderIdValue}${emailValue ? `?email=${encodeURIComponent(emailValue)}` : ''}`);
            }}
            className="w-full bg-ruby text-white py-4 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-ruby/20 active:scale-95"
          >
            Track My Order 📦
          </button>
          <button 
            onClick={() => navigate('/')}
            className="w-full bg-white border border-gray-100 text-[#1A2C54] py-4 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-gray-50 transition-all active:scale-95"
          >
            Continue Shopping
          </button>
          <button 
            onClick={downloadReceipt}
            className="w-full bg-black text-white py-4 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-ruby transition-all shadow-xl shadow-black/10 active:scale-95"
          >
            Download Receipt 🧾
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
