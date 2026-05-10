import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Users, ShoppingBag, TrendingUp, 
  Map as MapIcon, Globe, Search, ArrowUpRight, 
  Clock, Activity, ShoppingCart, UserPlus, MousePointer2,
  Calendar
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { collection, query, onSnapshot, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface Visitor {
  id: string;
  sessionId: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  path: string;
  lastCheckpoint?: string;
  lastSeen: any;
  startTime?: string;
  userEmail?: string;
}

interface LiveViewProps {
  totalSales: number;
  totalOrders: number;
  totalSessions: number;
  dateRange: { start: string, end: string };
  setDateRange: React.Dispatch<React.SetStateAction<{ start: string, end: string }>>;
  onRefresh?: () => void;
}

export default function LiveView({ totalSales, totalOrders, totalSessions, dateRange, setDateRange, onRefresh }: LiveViewProps) {
  const [activeVisitors, setActiveVisitors] = useState<Visitor[]>([]);
  const [behavior, setBehavior] = useState({ activeCarts: 0, checkingOut: 0 });
  const [activities, setActivities] = useState<any[]>([]);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // 1. Real-time Firestore Listener (Robust across all devices)
  useEffect(() => {
    // Show users active in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const q = query(
      collection(db, 'active_sessions'),
      where('lastSeen', '>=', Timestamp.fromDate(fiveMinutesAgo)),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const visitors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Visitor));
      
      // Sort by lastSeen descending
      const sortedVisitors = visitors.sort((a, b) => {
        const timeA = a.lastSeen?.toMillis?.() || 0;
        const timeB = b.lastSeen?.toMillis?.() || 0;
        return timeB - timeA;
      });

      setActiveVisitors(sortedVisitors);
      
      // Calculate behavior stats
      const activeCarts = visitors.filter(v => v.lastCheckpoint === 'cart' || v.path.includes('/cart')).length;
      const checkingOut = visitors.filter(v => v.lastCheckpoint === 'checkout' || v.path.includes('/checkout')).length;
      setBehavior({ activeCarts, checkingOut });
    });

    return () => unsubscribe();
  }, []);

  // 2. Socket.io for Real-time Activity Feed (Fast events)
  useEffect(() => {
    const socket = io(window.location.origin);
    socketRef.current = socket;

    socket.on('live_activity_event', (event) => {
      setActivities(prev => [{ 
        id: Math.random(), 
        ...event,
        timestamp: event.timestamp || new Date().toISOString() 
      }, ...prev].slice(0, 15));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Map Initialization
  useEffect(() => {
    if (!mapRef.current) {
      const map = L.map('live-view-map', {
        center: [20, 0],
        zoom: 2,
        zoomControl: false,
        attributionControl: false,
      });

      // Google Satellite Hybrid Layer
      L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 20,
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      
      // Fix for container sizing
      setTimeout(() => map.invalidateSize(), 500);

      // Auto-rotation effect for Global view
      let angle = 0;
      const rotationInterval = setInterval(() => {
        if (map.getZoom() <= 3) {
          angle += 0.5;
          map.panTo([20, angle % 360 - 180], { animate: true, duration: 1 });
        }
      }, 2000);

      return () => clearInterval(rotationInterval);
    }
  }, []);

  // Update Markers
  useEffect(() => {
    if (!markersLayerRef.current || !mapRef.current) return;
    
    markersLayerRef.current.clearLayers();

    activeVisitors.forEach(v => {
      if (v.lat && v.lng) {
        const isActive = v.lastCheckpoint === 'cart' || v.lastCheckpoint === 'checkout';
        const color = isActive ? '#E11D48' : '#3B82F6';
        const size = isActive ? 12 : 8;

        const pulseIcon = L.divIcon({
          className: '',
          html: `
            <div style="position:relative;width:${size*2}px;height:${size*2}px;">
              <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:.2;animation:pulse 2s infinite;"></div>
              <div style="position:absolute;inset:${size/2}px;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 10px ${color}80;"></div>
            </div>
            <style>
              @keyframes pulse {
                0% { transform: scale(1); opacity: 0.3; }
                100% { transform: scale(3); opacity: 0; }
              }
            </style>
          `,
          iconSize: [size*2, size*2],
          iconAnchor: [size, size]
        });

        L.marker([v.lat, v.lng], { icon: pulseIcon })
          .addTo(markersLayerRef.current!)
          .bindPopup(`<div class="font-bold text-xs">${v.city}, ${v.country}</div><div class="text-[10px] text-gray-500">${v.path}</div>`, { closeButton: false });
      }
    });

  }, [activeVisitors]);

  return (
    <div className="space-y-6">
      {/* Header Overlay Style */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-ruby/10 rounded-2xl flex items-center justify-center text-ruby">
            <Globe className="animate-spin-slow" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[#1A2C54]">Live <span className="text-ruby italic">Pulse</span></h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Global Activity Tracking</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="hidden md:flex bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm items-center gap-6">
             <div className="flex flex-col">
               <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Live Visitors</span>
               <span className="text-sm font-black text-[#1A2C54]">{activeVisitors.length}</span>
             </div>
             <div className="w-px h-6 bg-gray-100"></div>
             <div className="flex flex-col">
               <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Active Carts</span>
               <span className="text-sm font-black text-ruby">{behavior.activeCarts}</span>
             </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Map Box */}
        <div className="lg:col-span-2 space-y-6">
          <div className="relative bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden group">
            <div id="live-view-map" className="h-[450px] w-full z-0 group-hover:scale-[1.02] transition-transform duration-1000" />
            
            {/* Map Accents */}
            <div className="absolute top-6 left-6 z-10 space-y-2 pointer-events-none">
              <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-white shadow-lg flex items-center gap-3">
                <div className="ldot w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-bold text-[#1A2C54]">{activeVisitors.length} Browsing Now</span>
              </div>
            </div>

            <div className="absolute bottom-6 right-6 z-10 pointer-events-none">
              <div className="bg-[#1A2C54] text-white px-4 py-2 rounded-2xl shadow-2xl text-[10px] font-bold uppercase tracking-widest border border-white/10">
                Satellite Hybrid Mode
              </div>
            </div>

            {/* Legend */}
            <div className="absolute bottom-6 left-6 z-10">
              <div className="bg-white/90 backdrop-blur-md p-4 rounded-[1.5rem] border border-white shadow-lg space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Visitor</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-ruby rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">In Checkout</span>
                </div>
              </div>
            </div>
          </div>

          {/* Date Selector & Stats Bar */}
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="text-ruby" size={18} />
                <span className="text-xs font-bold text-[#1A2C54] uppercase tracking-widest">Analytics Period</span>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-[10px] font-bold text-[#1A2C54] focus:ring-2 focus:ring-ruby/20 outline-none"
                />
                <span className="text-gray-300">to</span>
                <input 
                  type="date" 
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-[10px] font-bold text-[#1A2C54] focus:ring-2 focus:ring-ruby/20 outline-none"
                />
                <button 
                  onClick={() => onRefresh?.()}
                  className="p-2 bg-ruby text-white rounded-xl hover:bg-black transition-all"
                >
                  <Search size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Sales', value: `₹${totalSales.toLocaleString()}`, icon: TrendingUp, color: 'text-ruby', bg: 'bg-ruby/5' },
              { label: 'Total Orders', value: totalOrders, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Sessions', value: totalSessions, icon: MousePointer2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Live Traffic', value: activeVisitors.length, icon: Activity, color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between group hover:border-ruby/20 transition-all">
                <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110", stat.bg, stat.color)}>
                  <stat.icon size={20} />
                </div>
                <div>
                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                  <p className="text-lg font-black text-[#1A2C54]">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sidebar Activity & Details */}
        <div className="space-y-6">
          {/* Customer behavior */}
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1A2C54] uppercase tracking-widest">Behavior Radar</h3>
              <Clock size={16} className="text-gray-300" />
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Carts</span>
                  <span className="text-xs font-black text-ruby">{behavior.activeCarts}</span>
                </div>
                <div className="h-2 bg-gray-50 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (behavior.activeCarts / Math.max(1, activeVisitors.length)) * 100)}%` }}
                    className="h-full bg-ruby"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Reached Checkout</span>
                  <span className="text-xs font-black text-[#1A2C54]">{behavior.checkingOut}</span>
                </div>
                <div className="h-2 bg-gray-50 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (behavior.checkingOut / Math.max(1, activeVisitors.length)) * 100)}%` }}
                    className="h-full bg-[#1A2C54]"
                  />
                </div>
              </div>

              <div className="pt-4 grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-2xl">
                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">Returning</p>
                  <p className="text-sm font-black text-[#1A2C54]">24%</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl">
                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">New User</p>
                  <p className="text-sm font-black text-ruby">76%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Activity Feed */}
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden flex flex-col h-[350px]">
             <div className="p-6 border-b border-gray-50 flex items-center justify-between shrink-0">
                <h3 className="text-sm font-bold text-[#1A2C54] uppercase tracking-widest">Live Activity</h3>
                <Activity size={16} className="text-ruby animate-pulse" />
             </div>
             <div className="flex-grow overflow-y-auto p-2">
               <AnimatePresence initial={false}>
                 {activities.length === 0 ? (
                   <div className="h-full flex flex-center text-center p-10 flex-col items-center justify-center space-y-2 opacity-30">
                     <Clock size={32} />
                     <p className="text-[10px] font-bold uppercase tracking-widest">Waiting for traffic...</p>
                   </div>
                 ) : (
                   activities.map((act) => (
                     <motion.div 
                        key={act.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-4 hover:bg-gray-50 rounded-2xl transition-colors flex items-start gap-4"
                     >
                       <div className={cn(
                         "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                         act.type === 'checkout' ? "bg-ruby/10 text-ruby" : "bg-blue-50 text-blue-600"
                       )}>
                         {act.type === 'checkout' ? <ShoppingBag size={18} /> : 
                          act.type === 'cart' ? <ShoppingCart size={18} /> : <MousePointer2 size={18} />}
                       </div>
                       <div className="min-w-0">
                         <p className="text-[11px] font-bold text-[#1A2C54] leading-tight mb-0.5">
                           {act.msg || `Visitor from ${act.city || 'Unknown'} reached ${act.type || 'page'}`}
                         </p>
                         <p className="text-[9px] text-gray-400 font-medium">
                           {format(new Date(act.timestamp), 'HH:mm:ss')} • {act.city || 'Global'}
                         </p>
                       </div>
                     </motion.div>
                   ))
                 )}
               </AnimatePresence>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
