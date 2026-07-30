import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShoppingBag, AlertTriangle, TrendingUp, Package, ChevronRight, Search, RotateCcw, X, Check, XCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { OrderItemSkeleton, Skeleton } from '../components/Skeleton';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { cn } from '../lib/utils';

const RETURN_STAGES = [
  { key: 'requested', label: 'Requested', desc: 'Request submitted' },
  { key: 'approved', label: 'Approved', desc: 'Pickup scheduled' },
  { key: 'picked up', label: 'Picked Up', desc: 'Item collected' },
  { key: 'refunded', label: 'Refunded', desc: 'Amount credited' },
];

function ReturnStatusTracker({ order }: { order: any }) {
  const isRejected = order.returnStatus?.toLowerCase() === 'rejected';
  const rawStatus = order.returnStatus?.toLowerCase() || 'requested';

  let currentStageIndex = 0;
  if (rawStatus === 'approved') currentStageIndex = 1;
  else if (rawStatus === 'picked up' || rawStatus === 'picked_up') currentStageIndex = 2;
  else if (rawStatus === 'refunded') currentStageIndex = 3;

  if (isRejected) {
    return (
      <div className="mt-6 bg-red-50/90 border border-red-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
            <XCircle size={22} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-red-950">Return Request Rejected</h4>
            <p className="text-xs text-red-700 font-medium">Your return request was reviewed by our team and could not be approved.</p>
          </div>
        </div>
        {order.returnReason && (
          <p className="text-xs text-red-800 pt-1"><span className="font-semibold text-red-950">Reason:</span> {order.returnReason}</p>
        )}
        {(order.returnAdminNotes || order.return_admin_notes) && (
          <p className="text-xs text-red-900 bg-red-100/80 p-3 rounded-xl border border-red-200 mt-2 font-medium">
            <span className="font-bold text-red-950">Return Rejected:</span> {order.returnAdminNotes || order.return_admin_notes}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6 bg-purple-50/70 border border-purple-100 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-100/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <RotateCcw size={16} className="text-purple-600" />
            <h4 className="text-xs sm:text-sm font-bold text-purple-950 uppercase tracking-wider">Return & Refund Progress</h4>
          </div>
          <p className="text-xs text-purple-800 mt-0.5">
            <span className="font-semibold text-purple-950">Reason:</span> {order.returnReason || 'Standard Return'}
          </p>
        </div>
        {order.returnRequestedAt && (
          <span className="text-[11px] font-semibold text-purple-700 bg-purple-100/80 px-3 py-1 rounded-full w-fit">
            Requested on {new Date(order.returnRequestedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>

      {/* Flipkart / Amazon Style Horizontal Progress Tracker */}
      <div className="py-2 px-2 sm:px-4">
        <div className="relative flex items-center justify-between">
          {/* Background Track Line */}
          <div className="absolute top-4 left-6 right-6 h-1 bg-purple-200/80 rounded-full z-0" />
          
          {/* Active Progress Line */}
          <div 
            className="absolute top-4 left-6 h-1 bg-gradient-to-r from-purple-600 to-emerald-500 rounded-full transition-all duration-500 z-0"
            style={{ width: `${(currentStageIndex / (RETURN_STAGES.length - 1)) * 85}%` }}
          />

          {RETURN_STAGES.map((stage, idx) => {
            const isStepDone = idx < currentStageIndex || (idx === currentStageIndex && rawStatus === 'refunded');
            const isCurrentActive = idx === currentStageIndex && !isStepDone;

            return (
              <div key={stage.key} className="relative z-10 flex flex-col items-center text-center">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all shadow-sm",
                  isStepDone ? "bg-emerald-500 text-white ring-4 ring-emerald-100" :
                  isCurrentActive ? "bg-purple-600 text-white ring-4 ring-purple-200 scale-110 shadow-md" :
                  "bg-white border-2 border-purple-200 text-purple-300"
                )}>
                  {isStepDone ? <Check size={16} /> : isCurrentActive ? <RotateCcw size={14} /> : idx + 1}
                </div>
                <span className={cn(
                  "mt-2 text-xs transition-all",
                  isStepDone ? "font-semibold text-emerald-800" :
                  isCurrentActive ? "font-bold text-purple-950 scale-105" :
                  "font-medium text-gray-400"
                )}>
                  {stage.label}
                </span>
                <span className="hidden sm:block text-[10px] text-gray-500 leading-tight mt-0.5">
                  {stage.desc}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {order.returnComments && (
        <p className="text-xs text-purple-900 italic bg-white/80 p-3 rounded-xl border border-purple-100">
          "{order.returnComments}"
        </p>
      )}
    </div>
  );
}

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

  // Cancellation states
  const [cancellingOrder, setCancellingOrder] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('Ordered by mistake');
  const [otherCancelReason, setOtherCancelReason] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // Scroll lock when modal is open
  useEffect(() => {
    if (cancellingOrder || returningOrder) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [cancellingOrder, returningOrder]);

  const handleInitiateCancel = (order: any) => {
    setCancellingOrder(order);
    setCancelReason('Ordered by mistake');
    setOtherCancelReason('');
  };

  const handleSubmitCancel = async () => {
    if (!cancellingOrder) return;
    const finalReason = cancelReason === 'Other' ? (otherCancelReason.trim() || 'Other') : cancelReason;
    setIsSubmittingCancel(true);
    const loadingToast = toast.loading("Cancelling order...");
    try {
      const reqTime = new Date().toISOString();
      const { error: supErr } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          return_reason: finalReason,
          return_comments: finalReason,
          return_requested_at: reqTime,
          return_status: 'Cancelled'
        })
        .eq('id', cancellingOrder.id);

      if (supErr) throw supErr;

      // Update local state
      setOrders(prevOrders => prevOrders.map(o => 
        o.id === cancellingOrder.id 
          ? { 
              ...o, 
              status: 'Cancelled',
              returnReason: finalReason,
              returnComments: finalReason,
              returnRequestedAt: reqTime,
              returnStatus: 'Cancelled'
            } 
          : o
      ));

      toast.success("Order cancelled successfully! 📦", { id: loadingToast });
      setCancellingOrder(null);
    } catch (err: any) {
      console.error("Error cancelling order:", err);
      toast.error("Failed to cancel order.", { id: loadingToast });
    } finally {
      setIsSubmittingCancel(false);
    }
  };

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
      const reqTime = new Date().toISOString();
      const { error: supUpdateErr } = await supabase
        .from('orders')
        .update({
          return_reason: returnReason,
          return_comments: returnComments,
          return_requested_at: reqTime,
          return_status: 'requested'
        })
        .eq('id', returningOrder.id);

      if (supUpdateErr) throw supUpdateErr;

      const returnDetails = {
        returnStatus: 'requested',
        returnReason,
        returnComments,
        returnRequestedAt: reqTime
      };
      
      // Send templated Admin notification for return request
      try {
        await fetch('/api/send-templated-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateKey: 'admin_return_request',
            params: {
              orderId: returningOrder.orderId || returningOrder.id
            },
            options: { url: '/admin' }
          })
        });
      } catch (pushErr) {
        console.error("Failed to trigger return request admin push:", pushErr);
      }
      
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

    const fetchOrders = async () => {
      try {
        const { data: supOrders, error: supErr } = await supabase
          .from('orders')
          .select('*')
          .eq('customer_email', user.email)
          .order('created_at', { ascending: false });

        if (supErr) {
          throw supErr;
        }

        const mappedOrders = (supOrders || []).map((o: any) => {
          let clientStatus = o.status;
          if (o.status === 'cancelled' && o.return_reason) {
            clientStatus = 'Return Requested';
          } else if (o.status === 'pending') {
            clientStatus = 'Pending';
          } else if (o.status === 'processing') {
            clientStatus = 'Processing';
          } else if (o.status === 'packed') {
            clientStatus = 'Packed';
          } else if (o.status === 'shipped') {
            clientStatus = 'Shipped';
          } else if (o.status === 'out_for_delivery') {
            clientStatus = 'Out for Delivery';
          } else if (o.status === 'delivered') {
            clientStatus = 'Delivered';
          } else if (o.status === 'cancelled') {
            clientStatus = 'Cancelled';
          }

          return {
            id: o.id,
            orderId: o.order_number,
            userId: user.uid,
            items: o.items || [],
            subtotal: o.subtotal ?? o.total,
            discount: o.discount ?? 0,
            shippingCost: o.shipping_cost ?? 0,
            codFee: o.cod_fee ?? 0,
            total: o.total,
            status: clientStatus,
            paymentMethod: o.payment_method,
            shippingMethod: o.shipping_method || 'Standard Delivery',
            email: o.customer_email || '',
            customerName: o.shipping_full_name || 'Customer',
            address: {
              name: o.shipping_full_name,
              number: o.shipping_phone,
              address: o.shipping_address,
              city: o.shipping_city,
              pincode: o.shipping_zip
            },
            createdAt: o.created_at,
            estimatedDelivery: o.estimated_delivery || '2-5 Days',
            paymentId: o.payment_id || 'COD',
            paymentStatus: o.payment_status,
            returnReason: o.return_reason,
            returnComments: o.return_comments,
            returnRequestedAt: o.return_requested_at,
            returnStatus: o.return_status,
            returnAdminNotes: o.return_admin_notes
          };
        });

        setOrders(mappedOrders);
      } catch (error) {
        console.error("Error fetching user orders from Supabase:", error);
        setOrders([]);
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

                  {/* Cancelled Banner */}
                  {order.status === 'Cancelled' && (
                    <div className="mt-6 bg-red-50/80 border border-red-200/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full bg-red-600" />
                          <p className="text-xs font-bold text-red-950 uppercase tracking-widest">Order Cancelled</p>
                        </div>
                        {order.returnReason && (
                          <p className="text-xs text-red-800"><span className="font-semibold text-red-950">Reason:</span> {order.returnReason}</p>
                        )}
                        {order.returnRequestedAt && (
                          <p className="text-[10px] text-red-500 font-medium">Cancelled on {new Date(order.returnRequestedAt).toLocaleDateString()}</p>
                        )}
                      </div>
                      <div className="sm:text-right shrink-0">
                        <span className="inline-flex py-1 px-3 text-[10px] font-black uppercase tracking-widest text-red-800 bg-red-100/60 border border-red-200/50 rounded-xl">
                          Cancelled
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Return details info banner */}
                  {order.returnReason && order.status !== 'Cancelled' && (
                    <ReturnStatusTracker order={order} />
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
                      {order.status !== 'Delivered' && order.status !== 'Cancelled' && order.status !== 'Returned' && order.status !== 'Refunded' && (
                        <button 
                          onClick={() => handleInitiateCancel(order)}
                          className="w-full sm:w-auto px-6 py-3 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all flex items-center justify-center space-x-2 border border-red-100"
                        >
                          <X size={14} />
                          <span>Cancel Order</span>
                        </button>
                      )}
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

      {/* Cancel Order Modal */}
      {cancellingOrder && (
        <div className="fixed inset-0 bg-[#0c162cf0] backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full my-auto shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] relative border border-gray-100 max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setCancellingOrder(null)}
              className="absolute right-5 top-5 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all"
            >
              <X size={18} />
            </button>

            <div className="space-y-6">
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600">
                  <AlertTriangle size={22} />
                </div>
                <h3 className="text-xl font-serif font-bold text-[#1A2C54]">Cancel Order</h3>
                <p className="text-xs text-gray-400">Order {cancellingOrder.orderId || `#${cancellingOrder.id.slice(-8).toUpperCase()}`}</p>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Please select reason for cancellation</label>
                
                <div className="space-y-2.5">
                  {[
                    "Ordered by mistake",
                    "Found a better price elsewhere",
                    "Delivery time is too long",
                    "Item no longer needed",
                    "Changed my mind",
                    "Other"
                  ].map((reason) => (
                    <label 
                      key={reason}
                      className={`flex items-center gap-3 p-3.5 rounded-2xl border text-xs font-semibold cursor-pointer transition-all ${
                        cancelReason === reason 
                          ? 'border-red-500 bg-red-50/30 text-red-900 shadow-sm' 
                          : 'border-gray-100 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="cancelReason"
                        value={reason}
                        checked={cancelReason === reason}
                        onChange={() => setCancelReason(reason)}
                        className="w-4 h-4 text-red-600 focus:ring-red-500 border-gray-300"
                      />
                      <span>{reason}</span>
                    </label>
                  ))}
                </div>

                {cancelReason === 'Other' && (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Specify Reason</label>
                    <textarea 
                      rows={3}
                      placeholder="Please tell us why you are cancelling..."
                      value={otherCancelReason}
                      onChange={(e) => setOtherCancelReason(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20 text-gray-700 placeholder:text-gray-300 resize-none transition-all"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button 
                  onClick={() => setCancellingOrder(null)}
                  disabled={isSubmittingCancel}
                  className="w-1/2 py-3.5 bg-gray-50 hover:bg-gray-100 text-[#1A2C54] rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  Keep Order
                </button>
                <button 
                  onClick={handleSubmitCancel}
                  disabled={isSubmittingCancel}
                  className="w-1/2 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-red-500/10 hover:shadow-lg hover:shadow-red-500/20 disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  <span>{isSubmittingCancel ? 'Cancelling...' : 'Confirm Cancel'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Return Request Modal */}
      {returningOrder && (
        <div className="fixed inset-0 bg-[#0c162cf0] backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] relative border border-gray-100 max-h-[90vh] overflow-y-auto">
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
