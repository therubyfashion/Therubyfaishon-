import React, { useEffect, useRef, useState, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Sun, Zap, ShoppingBag, User, Activity, Eye, ShoppingCart, Globe as GlobeIcon, MapPin } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, orderBy, limit, where, Timestamp, getDocs } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { io, Socket } from 'socket.io-client';

const ReactGlobe = lazy(() => import('react-globe.gl'));

// Helper to format currency
const formatINR = (val: number) => `₹${val.toLocaleString('en-IN')}`;

export default function LiveViewContent() {
  const globeRef = useRef<any>(null);
  const [realOrders, setRealOrders] = useState<any[]>([]);
  const [liveAnalytics, setLiveAnalytics] = useState<{ activeCount: number, visitors: any[] }>({ activeCount: 0, visitors: [] });
  const [metrics, setMetrics] = useState({
    visitors: 0,
    totalSales: 0,
    ordersToday: 0,
    activeCarts: 0,
    checkingOut: 0,
    sessions: 282,
  });

  const [globeSize, setGlobeSize] = useState({ width: 600, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle Resize for Globe
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setGlobeSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 🌍 SOCKET.IO FOR REAL TRACKING
  useEffect(() => {
    const socket: Socket = io();
    
    socket.on("live_analytics_update", (data: any) => {
      setLiveAnalytics(data);
      setMetrics(prev => ({
        ...prev,
        visitors: data.activeCount
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // 🟢 DATA FETCHING (Optimized)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const ordersSnap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(15)));
        const docs = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRealOrders(docs);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const ensureDate = (val: any) => {
          if (!val) return new Date(0);
          if (typeof val.toDate === 'function') return val.toDate();
          return new Date(val);
        };
        const todayDocs = docs.filter((d: any) => ensureDate(d.createdAt) >= today);
        const total = todayDocs.reduce((acc, curr: any) => acc + (curr.total || 0), 0);
        
        setMetrics(prev => ({
          ...prev,
          totalSales: total,
          ordersToday: todayDocs.length,
        }));

        const cartsSnap = await getDocs(query(collection(db, 'carts'), limit(50)));
        setMetrics(prev => ({
          ...prev,
          activeCarts: cartsSnap.docs.length,
          checkingOut: Math.floor(cartsSnap.docs.length * 0.15)
        }));
      } catch (error: any) {
        if (error.code === 'resource-exhausted') {
          console.warn("LiveView: Quota reached.");
        } else {
          console.warn("LiveView Data Fetch Error:", error.message);
        }
      }
    };

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user && (
        user.email === 'mdsagaransari65670@gmail.com' || 
        user.email?.toLowerCase().includes('rubi')
      )) {
        fetchData();
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Data for globe points
  const pointsData = useMemo(() => {
    return liveAnalytics.visitors.map(v => ({
      lat: v.lat || 0,
      lng: v.lng || 0,
      size: 0.15,
      color: '#3b9edd',
      name: `${v.city}, ${v.country}`
    }));
  }, [liveAnalytics.visitors]);

  // Order hotspots (recent orders)
  const orderRings = useMemo(() => {
    return realOrders.slice(0, 10).map(o => ({
      lat: o.address?.lat || 20.5937,
      lng: o.address?.lng || 78.9629,
      color: '#9b59b6',
      maxR: 1.5,
      propagationSpeed: 1
    }));
  }, [realOrders]);

  return (
    <div className="flex flex-col bg-[#F2F2F2] min-h-screen text-[#1A1A1A] font-inter">
      
      {/* 🌑 GLOBE SECTION (Real Earth Look) */}
      <div 
        ref={containerRef}
        className="relative bg-[#000511] h-[450px] md:h-[580px] overflow-hidden border-b border-white/5 shadow-2xl"
      >
        {/* Real Earth Label & Stats Overlay */}
        <div className="absolute top-6 left-6 flex flex-col gap-3 z-20">
           <div className="flex items-center gap-2.5 px-4 py-2 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-sm">
             <div className="w-2.5 h-2.5 rounded-full bg-[#00C851] animate-pulse shadow-[0_0_8px_rgba(0,200,81,0.4)]" />
             <span className="text-[12px] font-bold text-white tracking-tight">Live Platform Pulse</span>
           </div>
           
           <div className="flex flex-col gap-1.5 p-4 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl">
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Live Visitors</p>
              <h4 className="text-3xl font-black text-white leading-none">{metrics.visitors}</h4>
              <div className="flex items-center gap-1.5 mt-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                 <span className="text-[10px] font-bold text-gray-400">Tracking global activity</span>
              </div>
           </div>
        </div>

        {/* Legend */}
        <div className="absolute top-6 right-6 flex flex-col gap-2 z-20">
           <div className="flex items-center gap-2.5 px-3 py-1.5 bg-black/30 backdrop-blur-md rounded-full border border-white/5">
              <div className="w-2 h-2 rounded-full bg-[#9b59b6]" />
              <span className="text-[10px] font-bold text-white/70">Recent Orders</span>
           </div>
           <div className="flex items-center gap-2.5 px-3 py-1.5 bg-black/30 backdrop-blur-md rounded-full border border-white/5">
              <div className="w-2 h-2 rounded-full bg-[#3b9edd]" />
              <span className="text-[10px] font-bold text-white/70">Visitor Activity</span>
           </div>
        </div>

        {/* Search Bar - Aesthetic Focus */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-sm z-20">
           <div className="group flex items-center gap-3 px-5 py-3.5 bg-white/5 hover:bg-white/10 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl transition-all">
              <Search size={18} className="text-blue-400" />
              <input 
                type="text" 
                placeholder="Search visitor city..." 
                className="bg-transparent border-none text-sm font-medium text-white outline-none w-full placeholder:text-white/20" 
              />
           </div>
        </div>

        {/* React Globe Implementation */}
        <div className="absolute inset-0 z-10">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full text-white/20 font-bold uppercase tracking-widest animate-pulse">
              Initializing Earth...
            </div>
          }>
            <ReactGlobe
              ref={globeRef}
              width={globeSize.width}
              height={globeSize.height}
              backgroundColor="rgba(0,0,0,0)"
              globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
              bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
              pointsData={pointsData}
              pointColor="color"
              pointAltitude={0.01}
              pointRadius={0.5}
              pointLabel="name"
              ringsData={orderRings}
              ringColor={() => '#9b59b6'}
              ringMaxRadius="maxR"
              ringPropagationSpeed="propagationSpeed"
              ringRepeatPeriod={800}
              atmosphereColor="#3a9ad9"
              atmosphereAltitude={0.15}
            />
          </Suspense>
        </div>

        {/* Cinematic Vignette */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] z-15" />
      </div>

      {/* ⚪️ STATS SECTION */}
      <div className="p-3 md:p-6 space-y-2 max-w-lg mx-auto w-full">
        <div className="grid grid-cols-2 gap-2">
          {/* Visitors */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50 group hover:border-blue-200 transition-colors">
             <p className="text-[11px] font-bold text-gray-400 uppercase tracking-tight mb-1 underline decoration-dotted decoration-gray-200 underline-offset-4">Visitors right n...</p>
             <h3 className="text-3xl font-extrabold text-[#1A1A1A] flex items-center gap-2">
               {metrics.visitors}
               <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
             </h3>
          </div>
          {/* Sales */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50 group hover:border-blue-200 transition-colors">
             <p className="text-[11px] font-bold text-gray-400 uppercase tracking-tight mb-1 underline decoration-dotted decoration-gray-200 underline-offset-4">Total sales</p>
             <h3 className="text-[22px] font-extrabold text-[#1A1A1A]">{formatINR(metrics.totalSales)}</h3>
             <div className="flex items-center gap-1 mt-1">
                <span className="text-[10px] font-bold text-gray-400">+₹420</span>
                <span className="text-[10px] font-bold text-[#00963b]">+34%</span>
             </div>
          </div>

          {/* Sessions */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50">
             <p className="text-[11px] font-bold text-gray-400 uppercase tracking-tight mb-1 underline decoration-dotted decoration-gray-200 underline-offset-4">Sessions</p>
             <h3 className="text-3xl font-extrabold text-[#1A1A1A]">{metrics.sessions}</h3>
             <span className="text-[10px] font-bold text-[#00963b]">↑ 283%</span>
          </div>
          {/* Orders */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50">
             <p className="text-[11px] font-bold text-gray-400 uppercase tracking-tight mb-1 underline decoration-dotted decoration-gray-200 underline-offset-4">Orders</p>
             <h3 className="text-3xl font-extrabold text-[#1A1A1A]">{metrics.ordersToday}</h3>
             <span className="text-[10px] font-bold text-gray-300">—</span>
          </div>
        </div>

        {/* Behavior */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
           <div className="px-4 pt-4 pb-2">
              <h3 className="text-[14px] font-bold text-[#1A1A1A] underline decoration-dotted decoration-gray-200 underline-offset-4">Customer behavior</h3>
           </div>
           <div className="grid grid-cols-3 border-t border-gray-50">
              <div className="p-4 border-r border-gray-50">
                 <p className="text-[10px] font-bold text-gray-400 mb-1 underline decoration-dotted decoration-gray-200 underline-offset-4">Active carts</p>
                 <p className="text-2xl font-extrabold">{metrics.activeCarts}</p>
              </div>
              <div className="p-4 border-r border-gray-50">
                 <p className="text-[10px] font-bold text-gray-400 mb-1 underline decoration-dotted decoration-gray-200 underline-offset-4">Checking out</p>
                 <p className="text-2xl font-extrabold">{metrics.checkingOut}</p>
              </div>
              <div className="p-4">
                 <p className="text-[10px] font-bold text-gray-400 mb-1 underline decoration-dotted decoration-gray-200 underline-offset-4">Purchased</p>
                 <p className="text-2xl font-extrabold">{metrics.ordersToday}</p>
              </div>
           </div>
           <div className="p-4 pt-0 space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-gray-500">Added to cart</span>
                  <span>{metrics.activeCarts}</span>
                </div>
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: '14%' }} />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-gray-500">Reached checkout</span>
                  <span>{metrics.checkingOut}</span>
                </div>
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#9b59b6] rounded-full" style={{ width: '0%' }} />
                </div>
              </div>
           </div>
        </div>

        {/* Live Activity */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
           <div className="px-4 py-4 flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-[#1A1A1A] underline decoration-dotted decoration-gray-200 underline-offset-4">Live activity</h3>
              <div className="w-2 h-2 rounded-full bg-[#00C851] animate-pulse" />
           </div>
           <div className="divide-y divide-gray-50">
              {realOrders.length > 0 ? realOrders.slice(0, 5).map((order) => (
                <div key={order.id} className="flex gap-3 px-4 py-3 items-start animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-sm flex-shrink-0">🛍️</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 leading-normal">
                      <span className="font-bold">🇮🇳</span> Someone from {order.address?.city || 'India'} purchased {order.items?.[0]?.name || 'Product'}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Just now · <span className="text-[#d97706] font-bold">{formatINR(order.total || 0)}</span></p>
                  </div>
                </div>
              )) : (
                <div className="p-8 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">
                  Scanning for signals...
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
