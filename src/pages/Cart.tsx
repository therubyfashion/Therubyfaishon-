import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, ChevronLeft, Heart, Tag, Lock, CheckCircle2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { LoadingSpinner } from '../components/Skeleton';

import { useWishlist } from '../contexts/WishlistContext';

export default function Cart() {
  const { items, removeFromCart, updateQuantity, total, itemCount, appliedPromo, setAppliedPromo } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const navigate = useNavigate();
  const [promoCode, setPromoCode] = useState('');
  const [coupons, setCoupons] = useState<any[]>([]);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);

  useEffect(() => {
    const fetchCoupons = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'coupons'));
        const couponsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setCoupons(couponsData);
      } catch (error) {
        console.error("Error fetching coupons:", error);
      }
    };
    fetchCoupons();
  }, []);

  const handleMoveToWishlist = (item: any) => {
    if (!isInWishlist(item.id)) {
      toggleWishlist(item);
    }
    removeFromCart(item.id, item.selectedSize, item.selectedColor);
    toast.success('Moved to wishlist');
  };

  const handleApplyPromo = async () => {
    if (!promoCode) return;
    
    setIsApplyingPromo(true);
    // Simulate a small delay for better UX
    await new Promise(resolve => setTimeout(resolve, 800));

    const coupon = coupons.find(c => c.code.toUpperCase() === promoCode.toUpperCase());
    
    if (coupon) {
      // Check expiry
      if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
        toast.error('This coupon has expired');
        setIsApplyingPromo(false);
        return;
      }

      let discountAmount = 0;
      if (coupon.discountType === 'percentage') {
        discountAmount = total * (Number(coupon.value) / 100);
      } else {
        discountAmount = Number(coupon.value);
      }

      setAppliedPromo({ code: coupon.code, discount: discountAmount });
      toast.success('Promo code applied successfully!');
    } else {
      toast.error('Invalid promo code');
    }
    setIsApplyingPromo(false);
  };

  const subtotal = total;
  const discount = appliedPromo ? appliedPromo.discount : 0;
  const finalTotal = subtotal - discount;
  const savings = discount + (productComparePriceTotal() - subtotal);

  function productComparePriceTotal() {
    return items.reduce((sum, item) => sum + (item.comparePrice || item.price * 1.5) * item.quantity, 0);
  }

  if (itemCount === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center space-y-8">
        <div className="w-24 h-24 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-8">
          <ShoppingBag size={48} />
        </div>
        <h1 className="text-4xl font-serif font-bold text-[#1A2C54]">Your cart is empty</h1>
        <p className="text-gray-500 font-light tracking-wide max-w-sm mx-auto">
          Looks like you haven't added anything to your cart yet. Explore our collection to find your perfect piece.
        </p>
        <Link to="/shop" className="inline-block bg-ruby text-white px-12 py-5 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-ruby/20">
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-[#FDFDFD] min-h-screen pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 sm:h-20 flex items-center">
          <button 
            onClick={() => navigate(-1)} 
            className="group flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-[#1A2C54] hover:text-ruby transition-all"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-gray-100 flex items-center justify-center group-hover:border-ruby/20 group-hover:bg-ruby/5 transition-all">
              <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            </div>
            <span className="hidden sm:inline">Back to Shopping</span>
            <span className="sm:hidden">Back</span>
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-8 sm:pt-12 space-y-8 sm:space-y-10">
        <div className="space-y-1 sm:space-y-2">
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#1A2C54]">Shopping Cart</h1>
          <p className="text-xs sm:text-sm text-gray-400 font-medium">{itemCount} items in your cart</p>
        </div>

        {/* Items List */}
        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {items.map((item) => (
              <motion.div 
                key={`${item.id}-${item.selectedSize}-${item.selectedColor || ''}`}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-gray-100 rounded-[2rem] p-6 flex gap-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-28 h-28 bg-gray-50 rounded-2xl overflow-hidden flex-shrink-0">
                  {item.images[0] ? (
                    <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-200">
                      <ShoppingBag size={32} />
                    </div>
                  )}
                </div>
                
                <div className="flex-grow space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-bold text-[#1A2C54] leading-tight">{item.name}</h3>
                    <div className="flex flex-wrap gap-x-2 sm:gap-x-3 gap-y-0.5 text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      <span>Size: {item.selectedSize}</span>
                      {item.selectedColor && (
                        <>
                          <span className="text-gray-200">•</span>
                          <span>Colour: {item.selectedColor}</span>
                        </>
                      )}
                      <span className="text-gray-200">•</span>
                      <span>Brand: The Ruby</span>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-lg sm:text-xl font-bold text-ruby">₹{item.price.toLocaleString()}</span>
                    <span className="text-xs sm:text-sm text-gray-300 line-through font-medium">₹{(item.comparePrice || Math.round(item.price * 1.4)).toLocaleString()}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-1">
                    <div className="flex items-center bg-white border border-gray-100 rounded-lg overflow-hidden shrink-0">
                      <button 
                        onClick={() => updateQuantity(item.id, item.selectedSize, item.quantity - 1, item.selectedColor)}
                        className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-[#1A2C54] hover:bg-gray-50 transition-colors border-r border-gray-100"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-8 sm:w-12 text-center text-xs sm:text-sm font-bold text-[#1A2C54]">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.id, item.selectedSize, Math.min(item.stock, item.quantity + 1), item.selectedColor)}
                        className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-[#1A2C54] hover:bg-gray-50 transition-colors border-l border-gray-100"
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    <button 
                      onClick={() => removeFromCart(item.id, item.selectedSize, item.selectedColor)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ruby/10 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-ruby hover:bg-ruby hover:text-white transition-all active:scale-95"
                    >
                      <Trash2 size={12} />
                      <span>Remove</span>
                    </button>
                  </div>
                  
                  <button 
                    onClick={() => handleMoveToWishlist(item)}
                    className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#1A2C54] transition-colors flex items-center gap-1 pt-1"
                  >
                    Move to Wishlist
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Promo Code */}
        <div className="bg-white border border-gray-100 rounded-[2rem] p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center gap-2 text-[#1A2C54]">
            <Tag size={18} className="text-ruby" />
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-widest">Apply Promo Code</h3>
          </div>
          
          <AnimatePresence>
            {appliedPromo && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white">
                    <Sparkles size={14} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">You saved ₹{appliedPromo.discount.toLocaleString()} 🎉</p>
                    <p className="text-[9px] font-medium text-green-500">Coupon "{appliedPromo.code}" applied</p>
                  </div>
                </div>
                <button 
                  onClick={() => setAppliedPromo(null)}
                  className="text-[9px] font-bold text-green-600 uppercase tracking-widest hover:underline"
                >
                  Remove
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Enter Coupon"
              className="w-full bg-white border border-gray-100 px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-ruby/10 transition-all placeholder:text-gray-300"
            />
            <button 
              onClick={handleApplyPromo}
              disabled={isApplyingPromo}
              className="w-full sm:w-auto bg-ruby text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-bold uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-ruby/20 active:scale-95 shrink-0 flex items-center justify-center min-w-[100px]"
            >
              {isApplyingPromo ? <LoadingSpinner size={16} className="border-white" /> : 'Apply'}
            </button>
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-white border border-gray-100 rounded-[2rem] p-8 sm:p-10 space-y-8 shadow-sm">
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1A2C54]">Order Summary</h2>
          
          <div className="space-y-4">
            <div className="flex justify-between text-sm font-medium text-gray-400">
              <span>Subtotal ({itemCount} items)</span>
              <span className="text-[#1A2C54]">₹{subtotal.toLocaleString()}</span>
            </div>
            
            {discount > 0 ? (
              <div className="flex justify-between text-sm font-bold text-ruby">
                <div className="flex items-center gap-2">
                  <Tag size={14} />
                  <span>Coupon</span>
                </div>
                <span>-₹{discount.toLocaleString()}</span>
              </div>
            ) : (
              <div className="flex justify-between text-sm font-medium text-gray-300 italic">
                <span>Coupon</span>
                <span>₹0</span>
              </div>
            )}

            <div className="pt-6 border-t border-gray-50 flex justify-between items-end">
              <div className="space-y-1">
                <p className="text-base sm:text-lg font-bold text-[#1A2C54]">Total Payable</p>
                {savings > 0 && (
                  <p className="text-[9px] sm:text-[10px] font-bold text-green-500 uppercase tracking-widest flex items-center gap-1">
                    🎉 You save ₹{savings.toLocaleString()} on this order!
                  </p>
                )}
              </div>
              <p className="text-xl sm:text-2xl font-bold text-[#1A2C54]">₹{finalTotal.toLocaleString()}</p>
            </div>
          </div>

          <div className="space-y-4">
            <button 
              onClick={() => navigate('/checkout')}
              className="w-full bg-ruby text-white py-5 sm:py-6 rounded-2xl sm:rounded-[1.5rem] text-xs sm:text-sm font-bold uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center group shadow-2xl shadow-ruby/30 active:scale-95"
            >
              Proceed to Checkout →
            </button>
            
            <div className="flex items-center justify-center gap-2 text-[9px] sm:text-[10px] font-bold text-gray-300 uppercase tracking-widest">
              <Lock size={10} className="text-green-500" />
              <span>Secure Checkout • Powered by Razorpay</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
