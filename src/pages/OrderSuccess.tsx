import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Package, Truck, Home, ShoppingBag, ArrowRight, MapPin, CreditCard } from 'lucide-react';
import { motion } from 'motion/react';

import { generateInvoice } from '../utils/invoiceGenerator';

export default function OrderSuccess() {
  const location = useLocation();
  const navigate = useNavigate();
  const orderData = location.state || {
    orderId: '#LF-2025-84729',
    deliveryDate: 'Apr 5-7, 2025',
    total: 1978,
    subtotal: 2198,
    discount: 220,
    shippingCost: 0,
    paymentMethod: 'UPI',
    shippingMethod: 'Standard Delivery',
    address: {
      name: 'Priya Sharma',
      address: 'Flat 402, Sunshine Apartments, Bandra West, Mumbai',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400050'
    },
    items: [
      { name: 'Floral Summer Dress', selectedSize: 'S', price: 1299, quantity: 1 },
      { name: 'Embroidered Kurti', selectedSize: 'M', price: 899, quantity: 1 }
    ]
  };

  const downloadReceipt = () => {
    generateInvoice(orderData);
  };

  return (
    <div className="bg-[#FDFDFD] min-h-screen pb-24 pt-12">
      <div className="max-w-xl mx-auto px-4 space-y-10">
        {/* Success Icon & Title */}
        <div className="text-center space-y-6">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: 1
            }}
            transition={{
              scale: {
                repeat: Infinity,
                duration: 2,
                ease: "easeInOut"
              },
              opacity: { duration: 0.5 }
            }}
            className="w-32 h-32 bg-[#107C41]/10 rounded-full flex items-center justify-center mx-auto relative"
          >
            <div className="absolute inset-0 bg-[#107C41] rounded-full blur-2xl opacity-20" />
            <div className="w-24 h-24 bg-[#107C41] rounded-full flex items-center justify-center text-white shadow-xl relative z-10">
              <CheckCircle2 size={48} />
            </div>
          </motion.div>
          
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl font-serif italic text-[#1A2C54]">Order Placed!</h1>
            <p className="text-gray-400 text-sm sm:text-base leading-relaxed max-w-sm mx-auto font-medium">
              Your order has been confirmed. You'll receive a confirmation email and SMS shortly. Sit back and relax — your fashion is on its way!
            </p>
          </div>
        </div>

        {/* Order ID Card */}
        <div className="bg-white border border-gray-100 rounded-[2rem] p-8 text-center space-y-2 shadow-sm relative overflow-hidden group">
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
        </div>

        {/* Order Status Timeline */}
        <div className="bg-white border border-gray-100 rounded-[2rem] p-8 space-y-8 shadow-sm">
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
        </div>

        {/* Order Summary */}
        <div className="bg-white border border-gray-100 rounded-[2rem] p-8 space-y-6 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Order Summary</p>
          <div className="space-y-4">
            {orderData.items.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between text-sm font-bold text-[#1A2C54]">
                <span>{item.name} (Size {item.selectedSize})</span>
                <span>₹{(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-bold text-ruby">
              <span>Discount Applied</span>
              <span>-₹{orderData.discount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-green-500">
              <span>Delivery</span>
              <span>{orderData.shippingCost === 0 ? 'FREE' : `₹${orderData.shippingCost}`}</span>
            </div>
            <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
              <p className="text-lg font-bold text-[#1A2C54]">Total Paid</p>
              <p className="text-2xl font-bold text-ruby">₹{orderData.total.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Delivery Details Box */}
        <div className="bg-ruby/5 border border-ruby/10 rounded-[2rem] p-8 space-y-4">
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
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <button className="w-full bg-ruby text-white py-4 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-ruby/20 active:scale-95">
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
        </div>
      </div>
    </div>
  );
}
