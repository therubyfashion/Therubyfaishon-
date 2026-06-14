import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Package, 
  Truck, 
  MapPin, 
  CheckCircle2, 
  Search, 
  ArrowLeft,
  ShoppingBag,
  QrCode,
  X,
  Camera,
  Info,
  MapPin as MapIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '../firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

const steps = [
  { key: 'confirmed', label: 'Confirmed', icon: ShoppingBag },
  { key: 'packed', label: 'Packed', icon: Package },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

export default function TrackOrder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [orderIdInput, setOrderIdInput] = React.useState(id || '');
  const [emailInput, setEmailInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [order, setOrder] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showSearch, setShowSearch] = React.useState(!id);
  const [showScanner, setShowScanner] = React.useState(false);

  const fetchOrder = async (oid: string, emailStr: string): Promise<void> => {
    if (!oid || !emailStr) return;
    
    setLoading(true);
    setError(null);
    try {
      const cleanOid = oid.trim();
      const cleanEmail = emailStr.trim().toLowerCase();
      
      // We try multiple variations of orderId format since users might enter with/without #, with/without TRF, or uppercase/lowercase
      const cleanDigits = cleanOid.replace(/^#/, '').replace(/^TRF/i, '');
      const defaultId = `#TRF${cleanDigits.padStart(4, '0')}`;

      const idVariations = [
        cleanOid,
        cleanOid.toUpperCase(),
        cleanOid.toLowerCase(),
        cleanOid.startsWith('#') ? cleanOid : `#${cleanOid}`,
        cleanOid.startsWith('#') ? cleanOid.substring(1) : cleanOid,
        `#TRF${cleanDigits}`,
        `TRF${cleanDigits}`,
        `#TRF${cleanDigits.toUpperCase()}`,
        `TRF${cleanDigits.toUpperCase()}`,
        `#TRF${cleanDigits.toLowerCase()}`,
        `TRF${cleanDigits.toLowerCase()}`,
        `#TRF${cleanDigits.padStart(4, '0')}`,
        `TRF${cleanDigits.padStart(4, '0')}`,
        defaultId
      ];

      console.log("🔍 Looking for order with variations:", idVariations, "Email:", cleanEmail);

      const ordersRef = collection(db, 'orders');
      let foundOrder = null;

      // Primary query: Strict match on ID and Email
      const q = query(
        ordersRef, 
        where('orderId', 'in', idVariations),
        where('email', '==', cleanEmail),
        limit(1)
      );

      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        foundOrder = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
      } else {
        // Fallback: Some orders might store email in address.email
        const q2 = query(
          ordersRef,
          where('orderId', 'in', idVariations),
          limit(10) // Small limit to filter client-side
        );
        const snapshot2 = await getDocs(q2);
        const match = snapshot2.docs.find(doc => {
          const data = doc.data();
          const addrEmail = data.address?.email;
          return addrEmail?.toLowerCase() === cleanEmail.toLowerCase();
        });
        
        if (match) {
          foundOrder = { id: match.id, ...match.data() };
        }
      }

      if (!foundOrder) {
        throw new Error("Order not found. Please verify that the Order ID and Email are correct. (Note: Order ID may be case-sensitive)");
      }

      setOrder(foundOrder);
      setShowSearch(false);
      
      // Update URL without reload to support bookmarks
      const urlId = cleanOid.replace('#', '').toUpperCase();
      window.history.pushState({}, '', `/track/${urlId}`);
      
      toast.success("Order Found! Loading live journey... 📍");
    } catch (err: any) {
      console.error("Tracking error:", err);
      setError(err.message || "Error tracing order.");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    
    if (emailParam) {
      setEmailInput(emailParam);
      if (id) {
        fetchOrder(id, emailParam);
      }
    }
  }, [id]);

  React.useEffect(() => {
    if (showScanner) {
      // Use Html5Qrcode for better control
      const scannerId = "reader";
      const html5QrCode = new Html5Qrcode(scannerId);
      
      const config = { 
        fps: 20, 
        qrbox: { width: 280, height: 280 },
        aspectRatio: 1.0,
        disableFlip: false
      };

      const handleScanSuccess = (decodedText: string) => {
        try {
          // Play a small success vibration if available
          if (navigator.vibrate) navigator.vibrate(50);
          
          let targetOrderId = decodedText;
          try {
            const data = JSON.parse(decodedText);
            if (data.orderId) {
              targetOrderId = data.orderId;
              if (data.email) setEmailInput(data.email);
            }
          } catch (e) { /* Not JSON, use raw text */ }

          setOrderIdInput(targetOrderId);
          toast.success("Order ID Captured! 🎯");
          setShowScanner(false);
          html5QrCode.stop().catch(() => {});
          
          // Fast fetch
          if (targetOrderId && emailInput) {
             fetchOrder(targetOrderId, emailInput);
          }
        } catch (e) {
          console.error("Scan error", e);
        }
      };

      const handleScanError = (errorMessage: string) => {
        // Silent error
      };

      html5QrCode.start(
        { facingMode: "environment" },
        config,
        handleScanSuccess,
        handleScanError
      ).catch(err => {
        console.error("Scanner start error:", err);
        setError("Camera access denied. Please check your browser settings.");
        setShowScanner(false);
      });

      return () => {
        if (html5QrCode.isScanning) {
          html5QrCode.stop().catch(err => console.error("Scanner cleanup failed", err));
        }
      };
    }
  }, [showScanner]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderIdInput || !emailInput) {
      toast.error("Please enter both Order ID and Email");
      return;
    }
    fetchOrder(orderIdInput, emailInput);
  };

  const currentStatusIdx = (() => {
    const status = order?.status?.toLowerCase();
    if (status === 'delivered') return 3;
    if (status === 'shipped') return 2;
    if (status === 'packed' || status === 'processing') return 1;
    if (status === 'confirmed' || status === 'paid') return 0;
    return -1; // pending/placed
  })();

  const getTimelineItems = () => {
    if (!order) return [];
    
    // IF REAL TRACKING HISTORY EXISTS, USE IT
    if (order.trackingHistory && Array.isArray(order.trackingHistory) && order.trackingHistory.length > 0) {
      return [...order.trackingHistory].sort((a, b) => {
        const timeA = a.time?.seconds || a.time?._seconds || new Date(a.time).getTime() / 1000;
        const timeB = b.time?.seconds || b.time?._seconds || new Date(b.time).getTime() / 1000;
        return timeB - timeA; // Descending order (latest first)
      }).map(item => {
        let dateObj: Date;
        if (item.time?.toDate) {
          dateObj = item.time.toDate();
        } else if (item.time?._seconds) {
          dateObj = new Date(item.time._seconds * 1000);
        } else if (item.time?.seconds) {
          dateObj = new Date(item.time.seconds * 1000);
        } else {
          dateObj = new Date(item.time);
        }
        
        return {
          title: item.status || item.title,
          date: isNaN(dateObj.getTime()) ? 'Recently' : dateObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          time: isNaN(dateObj.getTime()) ? '--:--' : dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          location: item.location || 'Hub',
          description: item.description,
          completed: true
        };
      });
    }

    // FALLBACK TO GENERATED TIMELINE
    const orderDate = order.createdAt ? (order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt)) : new Date();
    const items = [
      {
        title: 'Verified Payments',
        date: orderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        time: '10:04 AM',
        location: 'Payment Gateway Secure Server',
        completed: true
      }
    ];

    if (currentStatusIdx >= 0) {
      items.unshift({
        title: 'Order is in Packing',
        date: orderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        time: '10:25 AM',
        location: 'Main Warehouse, Mumbai, IN',
        completed: currentStatusIdx >= 0
      });
    }

    if (currentStatusIdx >= 1) {
      items.unshift({
        title: 'Orders are Shipped',
        date: new Date(orderDate.getTime() + 3600000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        time: '11:30 AM',
        location: 'Logistics Hub, Ahmedabad, IN',
        completed: currentStatusIdx >= 1
      });
    }

    if (currentStatusIdx >= 2) {
      items.unshift({
        title: 'Order In Transit',
        date: new Date(orderDate.getTime() + 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        time: '15:20 PM',
        location: order.address?.city || 'Local Delivery Center',
        completed: currentStatusIdx >= 2
      });
    }

    if (currentStatusIdx >= 3) {
      items.unshift({
        title: 'Package Delivered',
        date: new Date(orderDate.getTime() + 172800000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        time: '18:45 PM',
        location: order.address?.name || 'Customer Location',
        completed: true
      });
    }

    return items;
  };

  return (
    <div className="min-h-screen bg-white font-sans text-shop-text">
      {/* Scanner Overlay */}
      <AnimatePresence>
        {showScanner && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[300] flex flex-col items-center justify-center p-6 text-white"
          >
            <button 
              onClick={() => setShowScanner(false)}
              className="absolute top-8 right-8 p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all"
            >
              <X size={24} />
            </button>
            <div className="max-w-md w-full text-center">
              <h2 className="text-xl font-bold font-syne mb-2">Scan Shipping Label</h2>
              <p className="text-gray-400 text-sm mb-8">Place the QR code on the label within the frame</p>
              
              <div className="relative group">
                <div id="reader" className="bg-black rounded-3xl overflow-hidden shadow-2xl shadow-ruby/40 border-4 border-ruby/30 min-h-[300px]"></div>
                
                {/* Pro Scanner Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-[280px] h-[280px] border-2 border-white/20 rounded-2xl relative overflow-hidden">
                     <div className="scanner-laser"></div>
                     
                     {/* Corners */}
                     <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-ruby rounded-tl-xl"></div>
                     <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-ruby rounded-tr-xl"></div>
                     <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-ruby rounded-bl-xl"></div>
                     <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-ruby rounded-br-xl"></div>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 flex items-center justify-center gap-2 text-ruby font-bold">
                <div className="w-2 h-2 rounded-full bg-ruby animate-ping" />
                Scanning for Order QR...
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Overlay */}
      <AnimatePresence>
        {showSearch && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white z-[200] p-6 lg:p-12 overflow-y-auto"
          >
            <div className="max-w-md mx-auto">
              <div className="flex items-center justify-between mb-8">
                <button 
                  onClick={() => {
                    if (order) setShowSearch(false);
                    else navigate(-1);
                  }}
                  className="p-2 -ml-2"
                >
                  <ArrowLeft size={24} />
                </button>
                <h2 className="text-xl font-bold font-syne uppercase tracking-tight">Search Order</h2>
                <div className="w-10" />
              </div>

              <div className="mb-12 text-center">
                <div className="inline-flex p-4 bg-gray-50 rounded-full mb-4">
                  <Package className="text-ruby" size={32} />
                </div>
                <h3 className="text-2xl font-black font-syne uppercase tracking-tight">Trace Your Parcel</h3>
                <p className="text-gray-400 text-sm">Enter details or scan the shipping label</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Order ID</label>
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-ruby transition-colors" size={18} />
                    <input 
                      type="text"
                      placeholder="e.g. #0001"
                      value={orderIdInput}
                      onChange={(e) => setOrderIdInput(e.target.value)}
                      className="w-full h-14 bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-14 text-sm font-bold tracking-wider outline-none focus:ring-4 focus:ring-ruby/5 focus:border-ruby/20 focus:bg-white transition-all uppercase"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowScanner(true)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-ruby/10 text-ruby rounded-xl hover:bg-ruby hover:text-white transition-all"
                    >
                      <QrCode size={18} />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Checkout Email</label>
                  <input 
                    type="email"
                    placeholder="Enter your registration email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full h-14 bg-gray-50 border border-gray-100 rounded-2xl px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-ruby/5 focus:border-ruby/20 focus:bg-white transition-all"
                  />
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-red-50 rounded-xl text-red-500 text-xs font-bold flex items-center gap-2 border border-red-100"
                  >
                    <X size={14} className="shrink-0 bg-red-100 rounded-full p-0.5" />
                    {error}
                  </motion.div>
                )}

                <div className="space-y-3">
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full h-14 bg-shop-text text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[13px] hover:bg-ruby transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-gray-200"
                  >
                    {loading ? 'Locating...' : 'Track Journey'}
                  </button>
                  
                  <button 
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="w-full h-14 bg-white text-ruby border-2 border-ruby/20 rounded-2xl font-black uppercase tracking-[0.2em] text-[13px] flex items-center justify-center gap-2 hover:bg-ruby/5 transition-all"
                  >
                    <Camera size={18} />
                    Scan Label QR
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Track View */}
      <div className="max-w-md mx-auto pb-20">
        {/* Sticky Header */}
        <div className="sticky top-0 bg-white z-50 px-6 py-4 flex items-center justify-between border-b border-gray-50">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold font-syne tracking-tight">Track Order</h1>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowScanner(true)} className="p-2 text-ruby">
              <QrCode size={22} />
            </button>
            <button onClick={() => setShowSearch(true)} className="p-2">
              <Search size={24} />
            </button>
          </div>
        </div>

        {order ? (
          <div className="mt-6 px-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Product Card */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-50 rounded-3xl p-4 flex gap-4 border border-gray-100"
            >
              <div className="w-24 h-24 bg-white rounded-2xl overflow-hidden shadow-sm flex-shrink-0 border border-gray-100 p-1">
                <img 
                  src={order.items?.[0]?.image || 'https://via.placeholder.com/150'} 
                  alt={order.items?.[0]?.name}
                  className="w-full h-full object-cover rounded-xl"
                />
              </div>
              <div className="flex-grow flex flex-col justify-between py-1">
                <div>
                  <h3 className="font-bold text-base leading-tight project-title line-clamp-1">{order.items?.[0]?.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-ruby" />
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-tight">
                      Order: {order.orderId}
                    </p>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                   <p className="text-lg font-black tracking-tight text-shop-text">₹{Number(order.items?.[0]?.price || 0).toLocaleString()}</p>
                   <span className="text-[10px] font-black text-gray-400 bg-gray-200/50 px-2 py-0.5 rounded-md uppercase tracking-widest">Qty: {order.items?.[0]?.quantity}</span>
                </div>
              </div>
            </motion.div>

            {/* Progress Visualizer */}
            <div className="bg-gray-50/50 rounded-[2rem] p-6 border border-gray-100">
              <div className="relative flex justify-between px-2">
                {/* Connector Line */}
                <div className="absolute top-5 left-8 right-8 h-1 bg-gray-200 -z-0" />
                <div 
                  className="absolute top-5 left-8 h-1 bg-ruby transition-all duration-1000 -z-0" 
                  style={{ width: `${(Math.max(0, currentStatusIdx) / (steps.length - 1)) * 100}%` }}
                />

                {steps.map((step, idx) => {
                  const isCompleted = idx <= currentStatusIdx;
                  return (
                    <div key={idx} className="flex flex-col items-center gap-3 relative z-10">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-500 ${isCompleted ? 'bg-shop-text text-white shadow-lg' : 'bg-white border-2 border-gray-100 text-gray-300'}`}>
                        <step.icon size={20} />
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center absolute -top-1 -right-1 border-2 border-white transition-colors duration-500 ${isCompleted ? 'bg-ruby text-white' : 'bg-gray-200 text-gray-400'}`}>
                        <CheckCircle2 size={10} strokeWidth={4} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-8 text-center px-4">
                <h4 className="text-xl font-black font-syne uppercase tracking-tight">
                  {order.status?.toLowerCase() === 'delivered' ? 'Package Delivered' : 
                   order.status?.toLowerCase() === 'shipped' ? 'Packet in Transit' :
                   (order.status?.toLowerCase() === 'in delivery' || order.status?.toLowerCase() === 'packet in delivery') ? 'Packet In Delivery' :
                   'Preparing Packet'}
                </h4>
                <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-[0.2em]">Live Tracking Active</p>
              </div>
            </div>

            {/* Detailed Timeline */}
            <div>
              <h3 className="text-lg font-bold font-syne uppercase tracking-tighter mb-6 flex items-center gap-2">
                <Truck size={20} className="text-ruby" />
                Live Status Journey
              </h3>
              
              {!order.fulfilledAt && !order.trackingNumber && (
                <div className="mb-8 p-6 bg-blue-50 border border-blue-100 rounded-[2rem] flex flex-col md:flex-row gap-4 items-center text-center md:text-left animate-in fade-in zoom-in duration-700">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                    <Info size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-blue-900 uppercase tracking-widest leading-none mb-1">Packet is Being Prepared</h4>
                    <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
                      Your order hasn't been shipped yet. We are packing it with care. As soon as it's shipped, the tracking number will be updated here.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-8 relative">
                {/* Vertical Line */}
                <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-gray-100" />

                {getTimelineItems().map((item, idx) => (
                  <div key={idx} className="flex gap-6 relative">
                    <div className={`relative z-10 w-6 h-6 rounded-full border-4 ${item.completed ? 'bg-white border-shop-text shadow-[0_0_0_2px_white]' : 'bg-white border-gray-100 shadow-[0_0_0_2px_white]'}`} />
                    <div className="flex-grow pb-2">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className={`text-base font-bold ${item.completed ? 'text-shop-text' : 'text-gray-400'}`}>
                          {item.title}
                        </h4>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.time}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-400 font-medium">{item.location}</p>
                        <span className="text-[10px] font-black text-gray-300">{item.date}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Details Card */}
            <div className="bg-gray-50/50 rounded-3xl p-6 border border-gray-50 space-y-4 shadow-sm hover:shadow-md transition-shadow">
               <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Shipment Summary</span>
                  <span className="text-[10px] font-black text-white uppercase tracking-widest bg-shop-text px-3 py-1.5 rounded-full">Secure Parcel</span>
               </div>
               <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 font-medium tracking-tight">Total Value</span>
                    <span className="font-black text-ruby">₹{Number(order.total || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 font-medium tracking-tight">Delivery Point</span>
                    <span className="font-bold text-right text-[11px] leading-tight max-w-[200px]">{order.address?.city}, {order.address?.pincode}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 font-medium tracking-tight">Tracking No.</span>
                    <span className="font-black text-[11px] uppercase tracking-wider">{order.trackingNumber || 'AUTO_E_HUB'}</span>
                  </div>
               </div>
            </div>

            {/* Back home */}
            <div className="pt-4 pb-12">
              <button 
                onClick={() => navigate('/')}
                className="w-full h-14 bg-shop-text text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[13px] hover:bg-ruby transition-all shadow-xl shadow-gray-200 active:scale-95"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center pt-20 px-10 text-center scale-up">
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center text-gray-200 mb-6 transition-transform hover:rotate-12 group">
              <Package size={48} className="group-hover:text-ruby/30 transition-colors" />
            </div>
            <h2 className="text-2xl font-black font-syne uppercase tracking-tight mb-2">Track Your Journey</h2>
            <p className="text-sm text-gray-400 font-medium mb-10">Enter your order details above or scan the label QR to see the live status of your beautiful package.</p>
            
            <div className="w-full space-y-4">
              <button 
                onClick={() => setShowSearch(true)}
                className="w-full h-14 bg-shop-text text-white rounded-2xl font-black uppercase tracking-[0.1em] text-[12px] flex items-center justify-center gap-3 shadow-lg shadow-gray-200"
              >
                <Search size={18} />
                Find By ID & Email
              </button>
              
              <button 
                onClick={() => setShowScanner(true)}
                className="w-full h-14 bg-white text-ruby border-2 border-ruby rounded-2xl font-black uppercase tracking-[0.1em] text-[12px] flex items-center justify-center gap-3"
              >
                <QrCode size={18} />
                Scan Label QR
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
