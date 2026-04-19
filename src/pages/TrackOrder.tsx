import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Package, 
  Truck, 
  MapPin, 
  CheckCircle2, 
  Search, 
  ChevronRight, 
  ExternalLink,
  Calendar,
  ShieldCheck,
  ArrowLeft,
  ShoppingBag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'delivered': return 'bg-green-500';
    case 'shipped': return 'bg-blue-500';
    case 'paid':
    case 'processing':
    case 'confirmed': return 'bg-ruby';
    case 'pending': return 'bg-gray-400';
    default: return 'bg-gray-400';
  }
};

const getStatusText = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'delivered': return 'Arrived safely';
    case 'shipped': return 'In transit';
    case 'processing': return 'Preparing for shipment';
    case 'paid':
    case 'confirmed': return 'Payment confirmed';
    case 'pending': return 'Awaiting payment';
    default: return status;
  }
};

export default function TrackOrder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [orderIdInput, setOrderIdInput] = React.useState(id || '');
  const [emailInput, setEmailInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [order, setOrder] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);

  const fetchOrder = async (oid: string, email: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/track-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: oid, email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Order not found or access denied.");
      }

      setOrder(data);
      window.history.pushState({}, '', `/track/${oid.toUpperCase()}`);
    } catch (err: any) {
      setError(err.message);
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
    } else if (id && emailInput) {
      fetchOrder(id, emailInput);
    }
  }, [id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderIdInput || !emailInput) {
      toast.error("Please enter both Order ID and Email");
      return;
    }
    fetchOrder(orderIdInput, emailInput);
  };

  const steps = [
    { key: 'placed', label: 'Order Placed', icon: ShoppingBag, desc: 'We received your order' },
    { key: 'paid', label: 'Confirmed', icon: ShieldCheck, desc: 'Payment verified successfully' },
    { key: 'shipped', label: 'Shipped', icon: Truck, desc: 'Your package is on the way' },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle2, desc: 'Package dropped off' },
  ];

  const currentStatusIdx = (() => {
    const status = order?.status?.toLowerCase();
    if (status === 'delivered') return 3;
    if (status === 'shipped') return 2;
    if (status === 'paid' || status === 'processing' || status === 'confirmed') return 1;
    return 0; // pending
  })();

  return (
    <div className="min-h-screen bg-gray-50 font-syne">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-[100]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-shop-text font-bold text-sm">
            <ArrowLeft size={18} />
            <span className="hidden sm:inline">Back to Store</span>
          </button>
          <div className="text-lg font-black tracking-tighter text-ruby">THE RUBY</div>
          <div className="w-[80px]" /> {/* Spacer */}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-5xl font-black text-shop-text tracking-tighter uppercase mb-4">Track Your Order</h1>
          <p className="text-gray-500 font-medium md:text-lg">Real-time updates on your shipment journey.</p>
        </div>

        {!order ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[2rem] p-6 md:p-10 shadow-xl shadow-gray-200/50 border border-gray-100 max-w-xl mx-auto"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Order ID</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input 
                    type="text"
                    placeholder="e.g. TRB-123456"
                    value={orderIdInput}
                    onChange={(e) => setOrderIdInput(e.target.value)}
                    className="w-full h-14 bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 text-sm font-bold tracking-wider outline-none focus:ring-4 focus:ring-ruby/5 focus:border-ruby/20 focus:bg-white transition-all"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                <input 
                  type="email"
                  placeholder="The email used for checkout"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full h-14 bg-gray-50 border border-gray-100 rounded-2xl px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-ruby/5 focus:border-ruby/20 focus:bg-white transition-all"
                />
              </div>

              {error && (
                <div className="p-4 bg-red-50 rounded-xl text-red-500 text-xs font-bold flex items-center gap-2">
                  <Package size={14} className="shrink-0" />
                  {error}
                </div>
              )}

              <button 
                type="submit"
                disabled={loading}
                className="w-full h-14 bg-shop-text text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[13px] hover:bg-ruby transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-gray-200"
              >
                {loading ? 'Searching...' : 'Track Package'}
              </button>
            </form>
          </motion.div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Order Info Card */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="md:col-span-2 space-y-6"
              >
                <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-xl shadow-gray-200/50 border border-gray-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-5">
                    <Package size={120} />
                  </div>
                  
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(order.status)} animate-pulse shadow-lg`} />
                        <h2 className="text-2xl font-black text-shop-text tracking-tighter uppercase">{getStatusText(order.status)}</h2>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Order ID</p>
                      <p className="text-lg font-black text-shop-text tracking-wider">{order.orderId || `#${order.id.slice(-6).toUpperCase()}`}</p>
                    </div>
                  </div>

                  {/* Horizontal Timeline */}
                  <div className="relative mt-12 mb-8 px-2">
                    <div className="absolute top-[18px] left-[40px] right-[40px] h-[2px] bg-gray-100" />
                    <div 
                      className="absolute top-[18px] left-[40px] h-[2px] bg-ruby transition-all duration-1000" 
                      style={{ width: `${(currentStatusIdx / (steps.length - 1)) * (100 * (steps.length - 1) / steps.length)}%` }}
                    />
                    
                    <div className="relative flex justify-between">
                      {steps.map((step, idx) => {
                        const isCompleted = idx <= currentStatusIdx;
                        const isCurrent = idx === currentStatusIdx;
                        return (
                          <div key={idx} className="flex flex-col items-center group relative z-10 w-20">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 border-2 ${isCompleted ? 'bg-ruby border-ruby text-white' : 'bg-white border-gray-100 text-gray-300'}`}>
                              <step.icon size={18} />
                            </div>
                            <div className="mt-4 text-center">
                              <p className={`text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${isCompleted ? 'text-shop-text' : 'text-gray-300'}`}>
                                {step.label}
                              </p>
                            </div>
                            {isCurrent && (
                                <motion.div layoutId="current-dot" className="absolute -top-1 w-2 h-2 bg-ruby rounded-full border-2 border-white shadow-lg" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {order.trackingNumber && (
                    <div className="mt-12 bg-gray-50 rounded-2xl p-5 border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-xl border border-gray-100 flex items-center justify-center text-ruby shadow-sm">
                          <Truck size={24} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1.5">{order.carrier || 'Standard Shipping'}</p>
                          <p className="text-base font-black text-shop-text tracking-[0.1em]">{order.trackingNumber}</p>
                        </div>
                      </div>
                      <a 
                        href={order.trackingUrl || '#'} 
                        target="_blank" 
                        rel="noreferrer"
                        className="w-full sm:w-auto px-6 h-11 bg-white border border-gray-200 rounded-xl text-[11px] font-black uppercase tracking-widest text-shop-text hover:bg-ruby hover:border-ruby hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm"
                      >
                        Visit Tracking Portal
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-[2rem] p-8 shadow-xl shadow-gray-200/50 border border-gray-100">
                  <h3 className="text-lg font-black text-shop-text tracking-tighter uppercase mb-6 flex items-center gap-2">
                    <ShoppingBag size={20} className="text-ruby" />
                    Manifest Details
                  </h3>
                  <div className="space-y-4">
                    {order.items?.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-50">
                        <img src={item.image} alt="" className="w-14 h-14 rounded-xl object-cover border border-gray-100 shadow-sm" />
                        <div className="flex-1">
                          <p className="text-sm font-bold text-shop-text">{item.name}</p>
                          <p className="text-[11px] text-gray-400 font-medium">{item.selectedSize ? `Size: ${item.selectedSize}` : ''} {item.selectedColor ? ` · Color: ${item.selectedColor}` : ''}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-shop-text">Qty: {item.quantity}</p>
                          <p className="text-xs font-black text-ruby mt-1">₹{item.price.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Sidebar Info */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/50 border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Delivery Address</p>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-ruby/10 flex items-center justify-center shrink-0">
                        <MapPin size={16} className="text-ruby" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-shop-text uppercase tracking-wider">{order.address?.name || order.customerName}</p>
                        <p className="text-xs text-gray-500 font-medium leading-relaxed">
                          {order.address?.address || order.shippingAddress?.line1},<br />
                          {order.address?.pincode || order.shippingAddress?.postal_code}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/50 border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Payment Summary</p>
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs font-medium text-gray-500">
                      <span>Subtotal</span>
                      <span>₹{(order.total - (order.shippingCost || 0)).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs font-medium text-gray-500">
                      <span>Shipping</span>
                      <span>{order.shippingCost > 0 ? `₹${order.shippingCost.toLocaleString()}` : 'FREE'}</span>
                    </div>
                    <div className="pt-3 border-t border-gray-50 flex justify-between items-end">
                      <span className="text-[10px] font-black text-shop-text uppercase tracking-widest">Total Paid</span>
                      <span className="text-xl font-black text-shop-text">₹{order.total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setOrder(null)}
                  className="w-full h-14 bg-gray-100 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] text-gray-500 hover:bg-gray-200 transition-all flex items-center justify-center gap-3"
                >
                  <Search size={16} />
                  Track Another
                </button>
              </motion.div>
            </div>
          </div>
        )}
      </div>

      {/* Trust Badges */}
      <div className="max-w-4xl mx-auto px-4 pb-16 text-center">
        <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-30 select-none grayscale">
          <div className="flex items-center gap-2 font-black text-[12px] uppercase tracking-widest">
            <ShieldCheck size={20} />
            Genuine Ruby
          </div>
          <div className="flex items-center gap-2 font-black text-[12px] uppercase tracking-widest">
            <Truck size={20} />
            Global Fast Delivery
          </div>
          <div className="flex items-center gap-2 font-black text-[12px] uppercase tracking-widest">
            <Calendar size={20} />
            7 Day Return
          </div>
        </div>
      </div>
    </div>
  );
}
