import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { ShoppingBag, AlertTriangle, TrendingUp, Package, ChevronRight, Search, RotateCcw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { OrderItemSkeleton, Skeleton } from '../components/Skeleton';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function MyOrders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Return request states
  const [returningOrder, setReturningOrder] = useState<any | null>(null);
  const [returnReason, setReturnReason] = useState('Wrong Size / Fit');
  const [returnComments, setReturnComments] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  const handleInitiateReturn = (order: any) => {
    setReturningOrder(order);
    setReturnReason('Wrong Size / Fit');
    setReturnComments('');
  };

  const handleSubmitReturn = async () => {
    if (!returningOrder) return;
    setIsSubmittingReturn(true);
    const loadingToast = toast.loading("Submitting return request...");
    try {
      const orderRef = doc(db, 'orders', returningOrder.id);
      const returnDetails = {
        status: 'Return Requested',
        returnStatus: 'Pending',
        returnReason,
        returnComments,
        returnRequestedAt: new Date().toISOString()
      };
      await updateDoc(orderRef, returnDetails);
      
      // Update local state so view re-renders instantly
      setOrders(prevOrders => prevOrders.map(o => 
        o.id === returningOrder.id 
          ? { ...o, ...returnDetails } 
          : o
      ));
      
      toast.success("Return request successfully submitted! ✨", { id: loadingToast });
      setReturningOrder(null);
    } catch (err: any) {
      console.error("Error submitting return request:", err);
      toast.error("Failed to submit return request.", { id: loadingToast });
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const fetchOrders = async () => {
      try {
        const snapshot = await getDocs(q);
        const ordersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Merge offline/local orders
        const localOrders = JSON.parse(localStorage.getItem('ruby_offline_orders') || '[]');
        const userLocalOrders = localOrders.filter((lo: any) => lo.userId === user.uid);
        const combined = [...ordersData];
        userLocalOrders.forEach((lo: any) => {
          if (!combined.some(o => (o as any).orderId === lo.orderId)) {
            combined.push({ ...lo, id: lo.orderId });
          }
        });
        setOrders(combined);
      } catch (error) {
        console.error("Error fetching user orders:", error);
        try {
          const localOrders = JSON.parse(localStorage.getItem('ruby_offline_orders') || '[]');
          const userLocalOrders = localOrders.filter((lo: any) => lo.userId === user.uid).map((lo: any) => ({
            ...lo,
            id: lo.orderId
          }));
          setOrders(userLocalOrders);
        } catch (err) {
          setOrders([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user]);

  const stats = [
    { label: 'Total Orders', value: orders.length, icon: ShoppingBag, color: 'text-ruby', bgColor: 'bg-ruby/10' },
    { label: 'Pending', value: orders.filter(o => o.status === 'Pending').length, icon: AlertTriangle, color: 'text-[#FACC15]', bgColor: 'bg-yellow-50' },
    { label: 'Delivered', value: orders.filter(o => o.status === 'Delivered').length, icon: TrendingUp, color: 'text-[#22C55E]', bgColor: 'bg-green-50' },
    { label: 'Cancelled', value: orders.filter(o => o.status === 'Cancelled').length, icon: AlertTriangle, color: 'text-[#EF4444]', bgColor: 'bg-red-50' },
  ];

  const filteredOrders = orders.filter(order => 
    order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (order.items && order.items.some((item: any) => item.name.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-3xl" />
          ))}
        </div>
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <OrderItemSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="space-y-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-serif font-bold">My Orders</h1>
            <p className="text-gray-400 mt-2">Track and manage your purchases</p>
          </div>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by Order ID or Product..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-ruby/20 font-medium transition-all"
            />
          </div>
        </div>

        {/* Stats Grid - 2 line grid for mobile responsiveness */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4"
            >
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${stat.bgColor} ${stat.color}`}>
                  <stat.icon size={24} />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
                  <h3 className="text-xl font-black text-[#1A2C54]">{stat.value}</h3>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Orders List */}
        <div className="space-y-6">
          {filteredOrders.length > 0 ? (
            filteredOrders.map((order, i) => (
              <motion.div 
                key={order.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all"
              >
                <div className="p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-gray-50">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-3">
                        <span className="text-xs font-bold text-ruby uppercase tracking-widest">Order {order.orderId || `#${order.id.slice(-8).toUpperCase()}`}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                          order.status === 'Delivered' ? 'bg-green-50 text-green-600' :
                          order.status === 'Cancelled' ? 'bg-red-50 text-red-600' :
                          order.status === 'Return Requested' ? 'bg-purple-150 text-purple-700 font-bold border border-purple-200' :
                          order.status === 'Returned' ? 'bg-orange-50 text-orange-600 font-semibold border border-orange-100' :
                          'bg-yellow-50 text-yellow-600'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 font-medium">Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-2xl font-black text-[#1A2C54]">₹{Number(order.total || 0).toLocaleString()}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Amount</p>
                    </div>
                  </div>

                  {/* Return details info banner */}
                  {order.returnReason && (
                    <div className="mt-6 bg-purple-50/70 border border-purple-100 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
                          <p className="text-xs font-bold text-purple-950 uppercase tracking-widest">Return Request Submitted</p>
                        </div>
                        <p className="text-xs text-purple-800"><span className="font-semibold text-purple-950">Reason:</span> {order.returnReason}</p>
                        {order.returnComments && (
                          <p className="text-xs text-purple-700 italic bg-purple-100/30 px-3 py-2 rounded-xl border border-purple-100/50 mt-1 max-w-2xl">
                            "{order.returnComments}"
                          </p>
                        )}
                        {order.returnRequestedAt && (
                          <p className="text-[10px] text-purple-500 font-medium">Requested on {new Date(order.returnRequestedAt).toLocaleDateString()}</p>
                        )}
                      </div>
                      <div className="sm:text-right shrink-0">
                        <span className="inline-flex px-3, py-1 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-purple-800 bg-purple-100/60 border border-purple-200/50 rounded-xl">
                          Return Status: {order.returnStatus || 'Pending'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="py-6 space-y-6">
                    {order.items?.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center space-x-4">
                        <div className="w-16 h-20 bg-gray-50 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100">
                          {(item.image || item.images?.[0]) ? (
                            <img src={item.image || item.images[0]} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                              <ShoppingBag size={20} />
                            </div>
                          )}
                        </div>
                        <div className="flex-grow">
                          <h4 className="text-sm font-bold text-[#1A2C54]">{item.name}</h4>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Size: {item.selectedSize} • Qty: {item.quantity}</p>
                        </div>
                        <p className="text-sm font-bold text-[#1A2C54]">₹{Number((item.price || 0) * (item.quantity || 1)).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-6 border-t border-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center space-x-2 text-gray-400">
                      <Package size={16} />
                      <span className="text-xs font-bold uppercase tracking-widest">Standard Shipping</span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                      {order.status === 'Delivered' && !order.returnReason && (
                        <button 
                          onClick={() => handleInitiateReturn(order)}
                          className="w-full sm:w-auto px-6 py-3 bg-purple-50 text-purple-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-600 hover:text-white transition-all flex items-center justify-center space-x-2 border border-purple-100/50"
                        >
                          <RotateCcw size={14} />
                          <span>Return Items</span>
                        </button>
                      )}
                      <button 
                        onClick={() => navigate(`/track/${order.orderId || order.id}`, { state: { email: order.email || order.address?.email } })}
                        className="w-full sm:w-auto px-8 py-3 bg-ruby/[0.05] text-ruby rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-ruby hover:text-white transition-all flex items-center justify-center space-x-2 border border-ruby/10"
                      >
                        <TrendingUp size={14} />
                        <span>Track Order</span>
                      </button>
                      <button 
                        onClick={() => navigate('/order-success', { state: order })}
                        className="w-full sm:w-auto px-8 py-3 bg-gray-50 text-[#1A2C54] rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all flex items-center justify-center space-x-2 group"
                      >
                        <span>View Details</span>
                        <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-24 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
              <ShoppingBag size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-serif font-bold text-gray-400">No orders found</h3>
              <p className="text-sm text-gray-400 mt-2">Start shopping to see your orders here!</p>
            </div>
          )}
        </div>
      </div>

      {/* Return Request Modal */}
      {returningOrder && (
        <div className="fixed inset-0 bg-[#0c162cf0] backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] relative border border-gray-100">
            <button 
              onClick={() => setReturningOrder(null)}
              className="absolute right-5 top-5 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all"
            >
              <X size={18} />
            </button>

            <div className="space-y-6">
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-700">
                  <RotateCcw size={22} />
                </div>
                <h3 className="text-xl font-serif font-bold text-[#1A2C54]">Initiate Return</h3>
                <p className="text-xs text-gray-400">Order {returningOrder.orderId || `#${returningOrder.id.slice(-8).toUpperCase()}`}</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Reason for Return</label>
                  <select 
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-gray-700 transition-all cursor-pointer"
                  >
                    <option value="Wrong Size / Fit">Wrong Size / Fit</option>
                    <option value="Item damaged or defective">Item damaged or defective</option>
                    <option value="Item does not match description">Item does not match description</option>
                    <option value="Quality not as expected">Quality not as expected</option>
                    <option value="Incorrect item delivered">Incorrect item delivered</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Comments or Additional Details</label>
                  <textarea 
                    rows={4}
                    placeholder="Provide any additional comments or sizing issues..."
                    value={returnComments}
                    onChange={(e) => setReturnComments(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-gray-700 placeholder:text-gray-300 resize-none transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setReturningOrder(null)}
                  disabled={isSubmittingReturn}
                  className="w-1/2 py-3.5 bg-gray-50 hover:bg-gray-100 text-[#1A2C54] rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSubmitReturn}
                  disabled={isSubmittingReturn}
                  className="w-1/2 py-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-purple-500/10 hover:shadow-lg hover:shadow-purple-500/20 disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  <span>{isSubmittingReturn ? 'Submitting...' : 'Submit Request'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
