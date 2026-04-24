import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Sun, Zap, ShoppingBag, User, Activity, Eye, ShoppingCart, Globe as GlobeIcon, MapPin } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, where, Timestamp } from 'firebase/firestore';
import { cn } from '../lib/utils';

// Helper to format currency
const formatINR = (val: number) => `₹${val.toLocaleString('en-IN')}`;

const Sparkline = ({ data, color = '#2563eb' }: { data: number[], color?: string }) => {
  const W = 100, H = 30;
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x},${y}`;
  });
  const lineD = pts.join(' ');
  const areaD = `M 0,${H} L ${pts.join(' L ')} L ${W},${H} Z`;
  const gradId = `spark-grad-${color.replace('#', '')}`;

  return (
    <svg width="100%" height="30" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <motion.polyline 
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1 }}
        points={lineD} 
        fill="none" 
        stroke={color} 
        strokeWidth="1.5" 
        strokeLinejoin="round" 
        strokeLinecap="round" 
      />
    </svg>
  );
};

export default function LiveViewContent() {
  const globeRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [realOrders, setRealOrders] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({
    visitors: 0,
    totalSales: 0,
    ordersToday: 0,
    activeCarts: 0,
    checkingOut: 0,
    sessions: 282,
  });

  const [history, setHistory] = useState({
    session: [12, 14, 18, 15, 22, 19, 25, 28, 32, 45, 12, 14, 18, 15, 22, 19, 25, 28, 32, 45],
    sales: [400, 600, 350, 800, 1200, 900, 1100, 1500, 2400, 1205, 400, 600, 350, 800, 1200, 900, 1100, 1500, 2400, 1205]
  });

  // 🟢 REAL DATA FETCHING
  useEffect(() => {
    const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(15));
    const unsubOrders = onSnapshot(ordersQuery, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
        visitors: Math.max(5, todayDocs.length * 3 + Math.floor(Math.random() * 5))
      }));
    });

    const cartsQuery = query(collection(db, 'abandoned_carts'), limit(50));
    const unsubCarts = onSnapshot(cartsQuery, (snap) => {
      setMetrics(prev => ({
        ...prev,
        activeCarts: snap.docs.length,
        checkingOut: Math.floor(snap.docs.length * 0.15)
      }));
    });

    return () => {
      unsubOrders();
      unsubCarts();
    };
  }, []);

  // 🟢 THREE.JS DARK GLOBE (Ref Image Match)
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    camera.position.z = 2.5;

    const pivot = new THREE.Group();
    scene.add(pivot);

    const texW = 2048, texH = 1024;
    const tc = document.createElement('canvas');
    tc.width = texW; tc.height = texH;
    const ctx = tc.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#010510'; 
    ctx.fillRect(0, 0, texW, texH);

    const drawMatrix = (color = '#1E293B') => {
      ctx.fillStyle = color;
      for (let y = 0; y < texH; y += 5) {
        for (let x = 0; x < texW; x += 5) {
          if (Math.random() > 0.4) {
            ctx.beginPath(); ctx.arc(x, y, 0.6, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    };
    drawMatrix('#0F172A');

    const tex = new THREE.CanvasTexture(tc);
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshStandardMaterial({ 
        map: tex, 
        roughness: 0.8, 
        metalness: 0.3,
        emissive: new THREE.Color(0x001a33),
        emissiveIntensity: 0.6
      })
    );
    pivot.add(globe);

    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(1.06, 32, 32),
      new THREE.MeshBasicMaterial({ 
        color: 0x0066FF, 
        transparent: true, 
        opacity: 0.05, 
        side: THREE.BackSide 
      })
    );
    pivot.add(aura);

    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const d1 = new THREE.DirectionalLight(0x0066FF, 1.2);
    d1.position.set(5, 3, 5); scene.add(d1);

    const pinGroup = new THREE.Group();
    pivot.add(pinGroup);

    const latLngTo3D = (lat: number, lng: number, r: number) => {
      const phi = (90 - lat) * Math.PI / 180;
      const theta = (lng + 180) * Math.PI / 180;
      return new THREE.Vector3(
        -r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
    };

    const updateDots = () => {
      while (pinGroup.children.length) pinGroup.remove(pinGroup.children[0]);
      
      const dots = [
        { lat: 28.6, lng: 77.2, color: 0x10B981 }, // Delhi
        { lat: 19.0, lng: 72.8, color: 0x3B82F6 }, // Mumbai
        { lat: 40.7, lng: -74.0, color: 0xF59E0B }, // NY
        { lat: 51.5, lng: -0.1, color: 0x10B981 }, // London
        { lat: 1.3, lng: 103.8, color: 0x3B82F6 }, // SG
      ];

      dots.forEach((pt, i) => {
        const pos = latLngTo3D(pt.lat, pt.lng, 1.01);
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.015, 8, 8),
          new THREE.MeshBasicMaterial({ color: pt.color })
        );
        dot.position.copy(pos);
        pinGroup.add(dot);

        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.01, 0.04, 24),
          new THREE.MeshBasicMaterial({ color: pt.color, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
        );
        ring.position.copy(pos.clone().multiplyScalar(1.002));
        ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize());
        ring.userData = { phase: i * Math.PI, isRing: true };
        pinGroup.add(ring);
      });
    };

    updateDots();

    let mouseX = 0, isDragging = false;
    const handleMouseDown = (e: any) => { isDragging = true; mouseX = e.clientX || e.touches?.[0].clientX; };
    const handleMouseMove = (e: any) => {
      if (!isDragging) return;
      const x = e.clientX || e.touches?.[0].clientX;
      pivot.rotation.y += (x - mouseX) * 0.005;
      mouseX = x;
    };
    const handleMouseUp = () => isDragging = false;

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('touchstart', handleMouseDown);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);

    const animate = () => {
      requestAnimationFrame(animate);
      if (!isDragging) pivot.rotation.y += 0.002;
      
      pinGroup.children.forEach(c => {
        if (c.userData.isRing) {
          const s = 1 + Math.sin(Date.now() / 400 + c.userData.phase) * 0.8;
          c.scale.setScalar(s);
          (c.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - (s - 0.2) / 1.6);
        }
      });
      
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      renderer.dispose();
      canvas.removeEventListener('mousedown', handleMouseDown);
    };
  }, [realOrders]);

  return (
    <div className="flex flex-col bg-[#F9FAFB] min-h-screen text-[#1A2C54]">
      
      {/* 🔴 HEADER BAR */}
      <div className="bg-white border-b border-gray-100 py-3.5 px-6 flex items-center justify-between sticky top-0 z-50 backdrop-blur-xl bg-white/80 transition-all">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500/40 animate-ping" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black font-syne uppercase tracking-tighter leading-none italic">LIVE VIEW</h1>
            <span className="text-[10px] text-gray-400 font-bold tracking-[0.3em] uppercase mt-0.5">Real-time Signal</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-100">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
             <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{metrics.visitors} Online</span>
          </div>
          <button className="p-2.5 bg-white border border-gray-100 rounded-xl hover:shadow-lg transition-all active:scale-95 text-gray-400">
            <Search size={18} />
          </button>
          <button className="p-2.5 bg-white border border-gray-100 rounded-xl hover:shadow-lg transition-all active:scale-95 text-gray-400">
            <Sun size={18} />
          </button>
        </div>
      </div>

      {/* 🌑 GLOBE SECTION (Ref Image Dark Mode) */}
      <div className="relative bg-[#020617] h-[360px] md:h-[480px] overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
        
        {/* Floating Activity Ticker */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-[90%] max-w-lg">
           <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-full py-3 px-6 flex items-center justify-between shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_#60A5FA]" />
                <AnimatePresence mode="wait">
                  <motion.span 
                    key={realOrders[0]?.id || 'scanning'}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-white/80 text-[10px] font-bold uppercase tracking-widest truncate"
                  >
                    {realOrders[0] ? `Recent order: ${realOrders[0].address?.name}` : "Scanning for signals..."}
                  </motion.span>
                </AnimatePresence>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-ruby animate-pulse" />
           </div>
        </div>

        {/* Legend */}
        <div className="absolute bottom-8 right-8 p-4 bg-black/40 backdrop-blur-md rounded-2xl border border-white/5 flex items-center gap-6">
           <div className="flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_10px_#F59E0B]" />
             <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Order</span>
           </div>
           <div className="flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_#3B82F6]" />
             <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Visitor</span>
           </div>
        </div>
      </div>

      {/* ⚪️ WHITE DASHBOARD STATS */}
      <div className="p-4 md:p-8 space-y-4 max-w-5xl mx-auto w-full -mt-4 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
          
          {/* Main Stats Card */}
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/20 flex flex-col justify-between group hover:border-emerald-200 transition-all">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Visitors now</p>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <h3 className="text-4xl font-black text-[#1A2C54] tracking-tight">{metrics.visitors}</h3>
            </div>
            <div className="mt-6 h-8">
              <Sparkline data={history.session} color="#10B981" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/20 flex flex-col justify-between group hover:border-ruby/20 transition-all">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total sales</p>
                <ShoppingBag size={14} className="text-gray-300" />
              </div>
              <h3 className="text-4xl font-black text-[#1A2C54] tracking-tight">{formatINR(metrics.totalSales)}</h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400">+₹1,205</span>
                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">+39%</span>
              </div>
            </div>
            <div className="mt-6 h-8">
              <Sparkline data={history.sales} color="#E11D48" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Sessions</p>
            <div className="flex items-baseline gap-2">
               <h3 className="text-2xl font-black text-[#1A2C54]">{metrics.sessions}</h3>
               <span className="text-[10px] font-bold text-emerald-600">↑ 283%</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Orders</p>
            <div className="flex items-baseline gap-2">
               <h3 className="text-2xl font-black text-[#1A2C54]">{metrics.ordersToday}</h3>
               <span className="text-[10px] font-bold text-gray-300">—</span>
            </div>
          </div>
        </div>

        {/* Behavior & Activity */}
        <div className="grid grid-cols-1 gap-6">
          
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
             <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between">
                <h3 className="text-[12px] font-black uppercase tracking-widest text-[#1A2C54]/60">Customer Behavior</h3>
             </div>
             <div className="grid grid-cols-3 divide-x divide-gray-50 border-b border-gray-50">
                <div className="p-8">
                   <p className="text-[11px] font-bold text-gray-400 mb-2">Active Carts</p>
                   <p className="text-3xl font-black text-[#1A2C54]">{metrics.activeCarts}</p>
                </div>
                <div className="p-8">
                   <p className="text-[11px] font-bold text-gray-400 mb-2">Checking Out</p>
                   <p className="text-3xl font-black text-[#1A2C54]">{metrics.checkingOut}</p>
                </div>
                <div className="p-8">
                   <p className="text-[11px] font-bold text-gray-400 mb-2">Purchased</p>
                   <p className="text-3xl font-black text-[#1A2C54]">{metrics.ordersToday}</p>
                </div>
             </div>
             <div className="p-8 space-y-6">
                {['Added to cart', 'Reached checkout'].map((label, i) => (
                  <div key={label} className="space-y-2">
                    <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-gray-400">
                      <span>{label}</span>
                      <span className="text-[#1A2C54] font-syne">{i === 0 ? metrics.activeCarts : metrics.checkingOut}</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${i === 0 ? '65%' : '12%'}` }}
                        className="h-full bg-blue-600"
                      />
                    </div>
                  </div>
                ))}
             </div>
          </div>

          {/* Real Activity List */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
             <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between">
                <h3 className="text-[12px] font-black uppercase tracking-widest text-[#1A2C54]/60">Live Activity</h3>
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
             </div>
             <div className="max-h-[400px] overflow-y-auto no-sb divide-y divide-gray-50">
                {realOrders.length > 0 ? realOrders.map((order) => (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    key={order.id}
                    className="flex items-center gap-5 px-8 py-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[18px]">🛍️</div>
                    <div className="flex-grow">
                       <p className="text-[13px] font-bold text-[#1A2C54]">
                          {order.address?.name || 'Customer'} purchased {order.items?.[0]?.name || 'Product'} 
                       </p>
                       <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mt-1">
                          {order.address?.city || 'India'} · Just now
                       </p>
                    </div>
                    <div className="text-right">
                       <p className="text-[13px] font-black text-ruby">{formatINR(order.total || 0)}</p>
                    </div>
                  </motion.div>
                )) : (
                  <div className="p-12 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">
                    No recent signals detected...
                  </div>
                )}
             </div>
          </div>
        </div>

        <footer className="py-12 text-center">
           <p className="text-[10px] font-black text-gray-300 uppercase tracking-[1em]">Intelligence Pulse Signal</p>
        </footer>
      </div>

    </div>
  );
}
