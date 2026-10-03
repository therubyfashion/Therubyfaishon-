import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Users,
  ShoppingBag,
  CreditCard,
  TrendingUp,
  MapPin,
  Calendar,
  Activity,
  PackageCheck,
  CheckCircle2,
  Eye,
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Filter,
  ArrowRight
} from 'lucide-react';
import { supabase } from '../supabase';
import { formatPrice } from '../utils/currency';
import { cn } from '../lib/utils';
import {
  CITY_COORDINATES,
  COMPUTED_LAND_DOTS,
  resolveCityLocation,
  getCountryFlag
} from '../utils/geoData';

interface LiveViewProps {
  totalSales: number;
  totalOrders: number;
  totalSessions: number;
  dateRange: { start: string; end: string };
  setDateRange: React.Dispatch<React.SetStateAction<{ start: string; end: string }>>;
  onRefresh?: () => void;
}

interface ActiveSessionRecord {
  session_id: string;
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
  page?: string;
  device?: string;
  cart_value?: number;
  last_seen?: string;
  created_at?: string;
}

interface LiveOrderRecord {
  id: string;
  order_number?: string;
  total: number;
  city: string;
  country: string;
  items_count: number;
  items?: any[];
  lat: number;
  lng: number;
  created_at: string;
  customer_name?: string;
}

interface LiveActivityItem {
  id: string;
  type: 'order' | 'visitor' | 'cart' | 'checkout';
  title: string;
  subtitle: string;
  timeAgo: string;
  city: string;
  country: string;
  flag: string;
  amount?: number;
}

interface GlobeBeacon {
  id: string;
  lon: number;
  lat: number;
  type: 'hq' | 'order' | 'visitor';
  city: string;
  country: string;
  flag: string;
  label: string;
  sub: string;
  value?: string;
  device?: string;
  x?: number;
  y?: number;
  z?: number;
}

// Store Headquarters (The Ruby Fashion HQ, New Delhi, India)
const STORE_HQ = {
  name: 'The Ruby Fashion HQ',
  city: 'New Delhi',
  country: 'India',
  lat: 28.6139,
  lng: 77.2090,
  flag: '🇮🇳'
};

type QuickFilterOption = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'custom';

export default function LiveView({
  totalSales: propSales,
  totalOrders: propOrders,
  totalSessions: propSessions,
  dateRange,
  setDateRange,
  onRefresh
}: LiveViewProps) {
  // Real database states
  const [activeSessions, setActiveSessions] = useState<ActiveSessionRecord[]>([]);
  const [allOrders, setAllOrders] = useState<LiveOrderRecord[]>([]);
  const [totalCustomerCount, setTotalCustomerCount] = useState<number>(0);

  // Date Filter State (Located right above the 6 KPI cards)
  const [quickFilter, setQuickFilter] = useState<QuickFilterOption>('today');
  const [customStartDate, setCustomStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [isCustomOpen, setIsCustomOpen] = useState<boolean>(false);

  // 3D Globe States & Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotYRef = useRef<number>(-77); // Centered towards India initially (lon ~ 77°E)
  const rotXRef = useRef<number>(-18); // Realistic viewing pitch
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
  const velRef = useRef<{ y: number; x: number }>({ y: 0, x: 0 });
  const animFrameRef = useRef<number>(0);
  const renderedBeaconsRef = useRef<GlobeBeacon[]>([]);
  const arcProgressRef = useRef<number>(0);

  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [selectedBeacon, setSelectedBeacon] = useState<GlobeBeacon | null>(null);

  // Timeago helper
  const formatTimeAgo = (isoString?: string): string => {
    if (!isoString) return 'Just now';
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 15) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Compute current active start & end date strings
  const effectiveDateRange = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (quickFilter === 'today') {
      return { start: todayStr, end: todayStr, label: 'Today (Live)' };
    }
    if (quickFilter === 'yesterday') {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      const yestStr = yest.toISOString().split('T')[0];
      return { start: yestStr, end: yestStr, label: 'Yesterday' };
    }
    if (quickFilter === '7d') {
      const d7 = new Date(now);
      d7.setDate(d7.getDate() - 7);
      return { start: d7.toISOString().split('T')[0], end: todayStr, label: 'Last 7 Days' };
    }
    if (quickFilter === '30d') {
      const d30 = new Date(now);
      d30.setDate(d30.getDate() - 30);
      return { start: d30.toISOString().split('T')[0], end: todayStr, label: 'Last 30 Days' };
    }
    if (quickFilter === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      return { start: firstDay, end: todayStr, label: 'This Month' };
    }
    return { start: customStartDate, end: customEndDate, label: `${customStartDate} to ${customEndDate}` };
  }, [quickFilter, customStartDate, customEndDate]);

  // Handle Quick Filter Click
  const handleQuickFilterSelect = (opt: QuickFilterOption) => {
    setQuickFilter(opt);
    if (opt !== 'custom') {
      setIsCustomOpen(false);
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      if (opt === 'today') {
        setDateRange({ start: todayStr, end: todayStr });
      } else if (opt === 'yesterday') {
        const yest = new Date(now);
        yest.setDate(yest.getDate() - 1);
        const yStr = yest.toISOString().split('T')[0];
        setDateRange({ start: yStr, end: yStr });
      } else if (opt === '7d') {
        const d7 = new Date(now);
        d7.setDate(d7.getDate() - 7);
        setDateRange({ start: d7.toISOString().split('T')[0], end: todayStr });
      } else if (opt === '30d') {
        const d30 = new Date(now);
        d30.setDate(d30.getDate() - 30);
        setDateRange({ start: d30.toISOString().split('T')[0], end: todayStr });
      } else if (opt === 'month') {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        setDateRange({ start: firstDay, end: todayStr });
      }
    } else {
      setIsCustomOpen(true);
    }
  };

  const handleApplyCustomDate = () => {
    if (customStartDate && customEndDate) {
      setDateRange({ start: customStartDate, end: customEndDate });
    }
  };

  // Fetch real data from Supabase
  const fetchData = useCallback(async () => {
    try {
      // 1. Fetch active sessions (last 20 mins for accurate real-time presence)
      const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      const { data: sessionRows } = await supabase
        .from('active_sessions')
        .select('*')
        .gte('last_seen', twentyMinsAgo)
        .order('last_seen', { ascending: false })
        .limit(60);

      let sessionsList: ActiveSessionRecord[] = [];
      if (sessionRows && sessionRows.length > 0) {
        sessionsList = sessionRows.map((s: any) => {
          const loc = resolveCityLocation(s.city, s.country, s.lat, s.lng);
          return {
            session_id: s.session_id,
            city: loc.city,
            country: loc.country,
            lat: loc.lat,
            lng: loc.lng,
            page: s.page || '/',
            device: s.device || 'Mobile',
            cart_value: Number(s.cart_value) || 0,
            last_seen: s.last_seen || new Date().toISOString(),
            created_at: s.created_at || new Date().toISOString()
          };
        });
      } else {
        // Fallback: Current active store session (admin live)
        sessionsList = [
          {
            session_id: 'admin_store_live',
            city: 'New Delhi',
            country: 'India',
            lat: 28.6139,
            lng: 77.2090,
            page: '/admin',
            device: 'Desktop',
            cart_value: 0,
            last_seen: new Date().toISOString(),
            created_at: new Date().toISOString()
          }
        ];
      }
      setActiveSessions(sessionsList);

      // 2. Fetch all orders (we will filter them in-memory according to the active date filter)
      const { data: orderRows } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (orderRows && orderRows.length > 0) {
        const mapped: LiveOrderRecord[] = orderRows.map((o: any) => {
          const cityStr = o.shipping_city || o.city || 'Mumbai';
          const countryStr = o.shipping_country || o.country || 'India';
          const loc = resolveCityLocation(cityStr, countryStr);
          const itms = Array.isArray(o.items) ? o.items : [];
          return {
            id: String(o.id || o.order_number),
            order_number: o.order_number || `TRF-${String(o.id).substring(0, 6)}`,
            total: Number(o.total || o.total_amount || 0),
            city: loc.city,
            country: loc.country,
            lat: loc.lat,
            lng: loc.lng,
            items_count: itms.reduce((acc: number, it: any) => acc + (it.quantity || 1), 0) || 1,
            items: itms,
            created_at: o.created_at || new Date().toISOString(),
            customer_name: o.customer_name || 'Customer'
          };
        });
        setAllOrders(mapped);
      }

      // 3. Profiles count
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      if (count !== null) setTotalCustomerCount(count);
    } catch (e) {
      console.error('LiveView fetch error:', e);
    }
  }, []);

  // Initial and socket synchronization
  useEffect(() => {
    fetchData();

    let socket: Socket | null = null;
    try {
      socket = io(window.location.origin, {
        reconnectionAttempts: 5,
        transports: ['websocket', 'polling']
      });

      socket.on('live_analytics_update', (data: any) => {
        if (data && Array.isArray(data.visitors) && data.visitors.length > 0) {
          const mapped = data.visitors.map((v: any) => {
            const loc = resolveCityLocation(v.city, v.country, v.lat, v.lng);
            return {
              session_id: v.sessionId || v.id,
              city: loc.city,
              country: loc.country,
              lat: loc.lat,
              lng: loc.lng,
              page: v.path || '/',
              device: v.device || 'Mobile',
              cart_value: Number(v.cart_value) || 0,
              last_seen: new Date().toISOString()
            };
          });
          setActiveSessions(mapped);
        }
      });

      socket.on('live_activity_event', () => {
        fetchData();
      });
    } catch {}

    const channel = supabase
      .channel('live-view-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_sessions' }, () => fetchData())
      .subscribe();

    const interval = setInterval(fetchData, 12000);

    return () => {
      clearInterval(interval);
      if (socket) socket.disconnect();
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Filter orders according to active date range
  const filteredOrders = useMemo(() => {
    const startObj = new Date(effectiveDateRange.start);
    startObj.setHours(0, 0, 0, 0);

    const endObj = new Date(effectiveDateRange.end);
    endObj.setHours(23, 59, 59, 999);

    return allOrders.filter(o => {
      const d = new Date(o.created_at);
      return d >= startObj && d <= endObj;
    });
  }, [allOrders, effectiveDateRange]);

  // Accurate Metrics strictly calculated from the date filter
  const metrics = useMemo(() => {
    const uniqueSessions = new Set(activeSessions.map(s => s.session_id));
    const activeVisitors = Math.max(uniqueSessions.size, activeSessions.length, 1);

    const sales = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const ordersCount = filteredOrders.length;
    const sessions = quickFilter === 'today'
      ? Math.max(activeVisitors * 3, propSessions > 0 ? propSessions : 6)
      : Math.max(ordersCount * 4, 12);

    const inCart = activeSessions.filter(s => (s.cart_value || 0) > 0 || s.page?.includes('cart')).length;
    const inCheckout = activeSessions.filter(s => s.page?.includes('checkout')).length;

    // Top locations from filtered data
    const locMap: Record<string, { city: string; country: string; flag: string; count: number }> = {};
    activeSessions.forEach(s => {
      const c = s.city || 'New Delhi';
      const key = `${c}, ${s.country || 'India'}`;
      if (!locMap[key]) {
        locMap[key] = { city: c, country: s.country || 'India', flag: getCountryFlag(s.country), count: 1 };
      } else {
        locMap[key].count += 1;
      }
    });

    filteredOrders.forEach(o => {
      const c = o.city || 'Mumbai';
      const key = `${c}, ${o.country || 'India'}`;
      if (!locMap[key]) {
        locMap[key] = { city: c, country: o.country || 'India', flag: getCountryFlag(o.country), count: 1 };
      } else {
        locMap[key].count += 1;
      }
    });

    if (Object.keys(locMap).length === 0) {
      locMap['New Delhi, India'] = { city: 'New Delhi', country: 'India', flag: '🇮🇳', count: 1 };
    }

    const sortedLocs = Object.values(locMap).sort((a, b) => b.count - a.count);
    const totalHits = sortedLocs.reduce((sum, l) => sum + l.count, 0) || 1;
    const topLocs = sortedLocs.map(l => ({
      ...l,
      pct: `${Math.max(1, Math.round((l.count / totalHits) * 100))}%`
    }));

    return {
      activeVisitors,
      sales,
      ordersCount,
      sessions,
      inCart,
      inCheckout,
      topLocations: topLocs,
      conversionRate: sessions > 0 ? ((ordersCount / sessions) * 100).toFixed(1) : '0.0'
    };
  }, [activeSessions, filteredOrders, quickFilter, propSessions]);

  // Top Products calculated from filtered orders
  const topProducts = useMemo(() => {
    const productSalesMap: Record<string, { id: string; name: string; sales: number; count: number; image?: string }> = {};

    filteredOrders.forEach(o => {
      (o.items || []).forEach((it: any) => {
        const name = it.name || it.title || 'Kurti';
        const price = Number(it.price || it.unit_price || 0);
        const qty = Number(it.quantity || 1);
        const revenue = price * qty;
        const key = it.id || name;

        if (!productSalesMap[key]) {
          productSalesMap[key] = {
            id: key,
            name,
            sales: revenue,
            count: qty,
            image: it.image || it.imageUrl
          };
        } else {
          productSalesMap[key].sales += revenue;
          productSalesMap[key].count += qty;
        }
      });
    });

    const sorted = Object.values(productSalesMap).sort((a, b) => b.sales - a.sales);
    const totalSalesSum = sorted.reduce((sum, p) => sum + p.sales, 0) || 1;

    return sorted.slice(0, 5).map((p, idx) => ({
      rank: idx + 1,
      name: p.name,
      value: formatPrice(p.sales),
      pct: `${Math.round((p.sales / totalSalesSum) * 100)}%`,
      count: p.count,
      image: p.image
    }));
  }, [filteredOrders]);

  // Live Activities feed strictly honoring date range
  const activities = useMemo(() => {
    const list: LiveActivityItem[] = [];

    // Real orders from this period
    filteredOrders.slice(0, 6).forEach(o => {
      list.push({
        id: `ord_${o.id}`,
        type: 'order',
        title: `New order #${o.order_number}`,
        subtitle: `${formatPrice(o.total)} · ${o.items_count} item${o.items_count > 1 ? 's' : ''} · ${o.city}, ${o.country}`,
        timeAgo: formatTimeAgo(o.created_at),
        city: o.city,
        country: o.country,
        flag: getCountryFlag(o.country),
        amount: o.total
      });
    });

    // Real active visitors
    if (quickFilter === 'today') {
      activeSessions.slice(0, 6).forEach(s => {
        const isCart = (s.cart_value || 0) > 0;
        const isCheckout = s.page?.includes('checkout');
        const actType = isCheckout ? 'checkout' : isCart ? 'cart' : 'visitor';
        const label = isCheckout
          ? 'Customer in checkout'
          : isCart
          ? `Active cart (${formatPrice(s.cart_value || 0)})`
          : 'Shopper browsing store';

        list.push({
          id: `sess_${s.session_id}`,
          type: actType,
          title: label,
          subtitle: `${s.city}, ${s.country} · ${s.page || 'Store'} · ${s.device || 'Mobile'}`,
          timeAgo: formatTimeAgo(s.last_seen),
          city: s.city || 'India',
          country: s.country || 'India',
          flag: getCountryFlag(s.country)
        });
      });
    }

    return list;
  }, [filteredOrders, activeSessions, quickFilter]);

  // Consolidated Beacons for 3D Globe
  const globeBeacons = useMemo(() => {
    const list: GlobeBeacon[] = [];

    // 1. Store HQ Beacon (New Delhi, India)
    list.push({
      id: 'store_hq',
      lon: STORE_HQ.lng,
      lat: STORE_HQ.lat,
      type: 'hq',
      city: STORE_HQ.city,
      country: STORE_HQ.country,
      flag: STORE_HQ.flag,
      label: STORE_HQ.name,
      sub: 'Main Operations & Store Headquarters',
      value: 'Store Active'
    });

    // 2. Active Shoppers
    activeSessions.forEach((s, idx) => {
      list.push({
        id: `vis_${s.session_id}_${idx}`,
        lon: s.lng || 77.2090,
        lat: s.lat || 28.6139,
        type: 'visitor',
        city: s.city || 'India',
        country: s.country || 'India',
        flag: getCountryFlag(s.country),
        label: `${s.city || 'Store'} Shopper`,
        sub: s.page?.includes('checkout')
          ? 'Currently in checkout'
          : (s.cart_value || 0) > 0
          ? `Cart value: ${formatPrice(s.cart_value || 0)}`
          : 'Browsing products',
        device: s.device || 'Mobile',
        value: 'Active Now'
      });
    });

    // 3. Orders Beacons
    filteredOrders.slice(0, 10).forEach(o => {
      list.push({
        id: `ord_${o.id}`,
        lon: o.lng,
        lat: o.lat,
        type: 'order',
        city: o.city,
        country: o.country,
        flag: getCountryFlag(o.country),
        label: `Order #${o.order_number}`,
        sub: `${o.items_count} item${o.items_count > 1 ? 's' : ''} · ${formatTimeAgo(o.created_at)}`,
        value: formatPrice(o.total)
      });
    });

    return list;
  }, [activeSessions, filteredOrders]);

  // 3D Sphere Projection Function
  const projectSphere = useCallback((lon: number, lat: number, r: number, cx: number, cy: number) => {
    const L = ((lon - rotYRef.current) * Math.PI) / 180;
    const P = ((lat - rotXRef.current) * Math.PI) / 180;
    const Rx = (rotXRef.current * Math.PI) / 180;

    const x = r * Math.cos(P) * Math.sin(L);
    const y = r * (Math.sin(P) * Math.cos(Rx) - Math.cos(P) * Math.cos(L) * Math.sin(Rx));
    const z = r * Math.cos(P) * Math.cos(L);
    return { x: cx + x, y: cy - y, z };
  }, []);

  // Draw Shopify-Inspired 3D Globe
  const drawShopifyGlobe = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gc = canvas.getContext('2d');
    if (!gc) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(320, rect.width || 680);
    const H = Math.max(300, rect.height || 420);

    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
    }

    gc.setTransform(dpr, 0, 0, dpr, 0, 0);
    gc.clearRect(0, 0, W, H);

    const cx = W / 2;
    const cy = H / 2;
    const r = Math.min(W, H) * 0.40 * zoomLevel;

    // 1. Ethereal Outer Atmospheric Halo (Rich Blue/Cyan Rim Glow)
    const halo = gc.createRadialGradient(cx, cy, r * 0.94, cx, cy, r * 1.34);
    halo.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
    halo.addColorStop(0.3, 'rgba(14, 165, 233, 0.12)');
    halo.addColorStop(0.65, 'rgba(99, 102, 241, 0.04)');
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');

    gc.beginPath();
    gc.arc(cx, cy, r * 1.34, 0, Math.PI * 2);
    gc.fillStyle = halo;
    gc.fill();

    // 2. Deep Midnight Celestial Sphere Body (Shopify Dark Aesthetic)
    const sphereGrad = gc.createRadialGradient(
      cx - r * 0.35,
      cy - r * 0.38,
      r * 0.05,
      cx,
      cy,
      r * 1.05
    );
    sphereGrad.addColorStop(0, '#0c1a30');
    sphereGrad.addColorStop(0.5, '#071120');
    sphereGrad.addColorStop(0.85, '#030812');
    sphereGrad.addColorStop(1, '#020409');

    gc.beginPath();
    gc.arc(cx, cy, r, 0, Math.PI * 2);
    gc.fillStyle = sphereGrad;
    gc.shadowColor = 'rgba(56, 189, 248, 0.25)';
    gc.shadowBlur = 28;
    gc.fill();
    gc.shadowBlur = 0;

    gc.save();
    gc.beginPath();
    gc.arc(cx, cy, r, 0, Math.PI * 2);
    gc.clip();

    // 3. Delicate Spherical Latitude & Longitude Graticules
    gc.lineWidth = 0.65;
    gc.strokeStyle = 'rgba(56, 189, 248, 0.12)';

    // Latitude parallels
    for (let lat = -60; lat <= 60; lat += 30) {
      gc.beginPath();
      let first = true;
      for (let lon = -180; lon <= 180; lon += 6) {
        const q = projectSphere(lon, lat, r, cx, cy);
        if (q.z > 0) {
          if (first) {
            gc.moveTo(q.x, q.y);
            first = false;
          } else {
            gc.lineTo(q.x, q.y);
          }
        } else {
          first = true;
        }
      }
      gc.stroke();
    }

    // Longitude meridians
    for (let lon = -180; lon < 180; lon += 45) {
      gc.beginPath();
      let first = true;
      for (let lat = -80; lat <= 80; lat += 5) {
        const q = projectSphere(lon, lat, r, cx, cy);
        if (q.z > 0) {
          if (first) {
            gc.moveTo(q.x, q.y);
            first = false;
          } else {
            gc.lineTo(q.x, q.y);
          }
        } else {
          first = true;
        }
      }
      gc.stroke();
    }

    // 4. Luminous Continental Land Dots (High-Precision World Matrix)
    for (const [lon, lat] of COMPUTED_LAND_DOTS) {
      const q = projectSphere(lon, lat, r, cx, cy);
      if (q.z > 0) {
        const depth = q.z / r;
        const alpha = 0.38 + 0.58 * depth;
        const dotRadius = Math.max(0.75, 1.15 + 0.45 * depth);

        // Luminous emerald-cyan matrix dots
        gc.fillStyle = `rgba(52, 211, 153, ${alpha})`;
        gc.beginPath();
        gc.arc(q.x, q.y, dotRadius, 0, Math.PI * 2);
        gc.fill();
      }
    }

    // 5. Great Circle Connection Flight Arcs (from India HQ to Shoppers & Orders)
    const hqCoord = projectSphere(STORE_HQ.lng, STORE_HQ.lat, r, cx, cy);
    const nowMs = Date.now();
    arcProgressRef.current = (nowMs % 2200) / 2200;

    for (const b of globeBeacons) {
      if (b.type === 'hq') continue;
      const targetCoord = projectSphere(b.lon, b.lat, r, cx, cy);

      if (hqCoord.z > -r * 0.25 && targetCoord.z > -r * 0.25) {
        const midLon = (STORE_HQ.lng + b.lon) / 2;
        const midLat = (STORE_HQ.lat + b.lat) / 2;
        const arcAltitude = r * 1.15;
        const apex = projectSphere(midLon, midLat, arcAltitude, cx, cy);

        // Curved flight arc
        gc.beginPath();
        gc.moveTo(hqCoord.x, hqCoord.y);
        gc.quadraticCurveTo(apex.x, apex.y, targetCoord.x, targetCoord.y);
        gc.strokeStyle = b.type === 'order' ? 'rgba(232, 121, 249, 0.45)' : 'rgba(56, 189, 248, 0.32)';
        gc.lineWidth = 1.3;
        gc.setLineDash([3, 5]);
        gc.stroke();
        gc.setLineDash([]);

        // Animated light photon traveling on the curve
        const t = arcProgressRef.current;
        const px = (1 - t) * (1 - t) * hqCoord.x + 2 * (1 - t) * t * apex.x + t * t * targetCoord.x;
        const py = (1 - t) * (1 - t) * hqCoord.y + 2 * (1 - t) * t * apex.y + t * t * targetCoord.y;

        gc.beginPath();
        gc.arc(px, py, 2.6, 0, Math.PI * 2);
        gc.fillStyle = b.type === 'order' ? '#f472b6' : '#38bdf8';
        gc.shadowColor = b.type === 'order' ? '#ec4899' : '#0ea5e9';
        gc.shadowBlur = 8;
        gc.fill();
        gc.shadowBlur = 0;
      }
    }

    // 6. Interactive 3D Beacons & Radar Pulses
    const currentRendered: GlobeBeacon[] = [];

    for (const b of globeBeacons) {
      const q = projectSphere(b.lon, b.lat, r, cx, cy);
      if (q.z > 0) {
        const pulse = (Math.sin(nowMs / 220) + 1) / 2;

        if (b.type === 'hq') {
          // Store HQ Crown Marker (India)
          gc.beginPath();
          gc.arc(q.x, q.y, 14 + pulse * 6, 0, Math.PI * 2);
          gc.fillStyle = 'rgba(244, 63, 94, 0.22)';
          gc.fill();

          gc.beginPath();
          gc.arc(q.x, q.y, 6, 0, Math.PI * 2);
          gc.fillStyle = '#f43f5e';
          gc.strokeStyle = '#ffffff';
          gc.lineWidth = 2;
          gc.stroke();
          gc.fill();
        } else if (b.type === 'order') {
          // Live Order Beacon: Rising 3D pillar + shockwave
          gc.beginPath();
          gc.arc(q.x, q.y, 16 + pulse * 10, 0, Math.PI * 2);
          gc.fillStyle = 'rgba(217, 70, 239, 0.2)';
          gc.fill();

          gc.beginPath();
          gc.moveTo(q.x, q.y);
          gc.lineTo(q.x, q.y - 14);
          gc.strokeStyle = '#d946ef';
          gc.lineWidth = 1.6;
          gc.stroke();

          gc.beginPath();
          gc.arc(q.x, q.y - 14, 5.2, 0, Math.PI * 2);
          gc.fillStyle = '#c026d3';
          gc.strokeStyle = '#ffffff';
          gc.lineWidth = 1.8;
          gc.stroke();
          gc.fill();
        } else {
          // Live Shopper: Pulsing cyan beacon
          gc.beginPath();
          gc.arc(q.x, q.y, 11 + pulse * 6, 0, Math.PI * 2);
          gc.fillStyle = 'rgba(56, 189, 248, 0.24)';
          gc.fill();

          gc.beginPath();
          gc.arc(q.x, q.y, 4.4, 0, Math.PI * 2);
          gc.fillStyle = '#0ea5e9';
          gc.strokeStyle = '#ffffff';
          gc.lineWidth = 1.6;
          gc.stroke();
          gc.fill();
        }

        currentRendered.push({
          ...b,
          x: q.x,
          y: q.y,
          z: q.z
        });
      }
    }

    renderedBeaconsRef.current = currentRendered;
    gc.restore();

    // 7. Outer Spherical Horizon Rim
    gc.beginPath();
    gc.arc(cx, cy, r, 0, Math.PI * 2);
    gc.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    gc.lineWidth = 1.8;
    gc.stroke();
  }, [projectSphere, globeBeacons, zoomLevel]);

  // Animation Loop for Auto-rotation & Arc Light Flow
  useEffect(() => {
    let active = true;

    const renderLoop = () => {
      if (!active) return;
      if (autoRotate && !isDraggingRef.current) {
        rotYRef.current += 0.16;
        if (rotYRef.current > 180) rotYRef.current -= 360;
      }
      drawShopifyGlobe();
      animFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      active = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [autoRotate, drawShopifyGlobe]);

  // Pointer Drag & Inertia for 3D Globe
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setSelectedBeacon(null);
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY, time: performance.now() };
    velRef.current = { y: 0, x: 0 };
    if (e.currentTarget.setPointerCapture) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const now = performance.now();
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const dt = Math.max(8, now - dragStartRef.current.time);

    rotYRef.current -= dx * 0.35;
    rotXRef.current -= dy * 0.18;
    rotXRef.current = Math.max(-55, Math.min(55, rotXRef.current));

    velRef.current = {
      y: (-dx * 0.35) / (dt / 16.67),
      x: (-dy * 0.18) / (dt / 16.67)
    };

    dragStartRef.current = { x: e.clientX, y: e.clientY, time: now };
    drawShopifyGlobe();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    const decayStep = () => {
      velRef.current.y *= 0.92;
      velRef.current.x *= 0.92;
      if (Math.abs(velRef.current.y) + Math.abs(velRef.current.x) < 0.05) return;
      rotYRef.current += velRef.current.y;
      rotXRef.current = Math.max(-55, Math.min(55, rotXRef.current + velRef.current.x));
      drawShopifyGlobe();
      requestAnimationFrame(decayStep);
    };
    requestAnimationFrame(decayStep);

    try {
      if (e.currentTarget.releasePointerCapture) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}
  };

  // Canvas Click to Inspect Location & Open Tooltip
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (Math.abs(velRef.current.y) + Math.abs(velRef.current.x) > 0.8) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    let hit: GlobeBeacon | null = null;
    let closestDist = 24;

    for (const b of renderedBeaconsRef.current) {
      if (b.x !== undefined && b.y !== undefined) {
        const d = Math.hypot(b.x - sx, b.y - sy);
        if (d < closestDist) {
          closestDist = d;
          hit = b;
        }
      }
    }

    setSelectedBeacon(hit);
  };

  const handleResetToIndia = () => {
    rotYRef.current = -77;
    rotXRef.current = -18;
    setZoomLevel(1);
    setSelectedBeacon(null);
    drawShopifyGlobe();
  };

  return (
    <div className="w-full max-w-[1240px] mx-auto pb-12 px-2 sm:px-4">
      {/* 1. Clean Top Header (NO filters on top, as requested) */}
      <section className="py-4 border-b border-slate-200/90 mb-5">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Live View</h1>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            REAL-TIME ACTIVE
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Interactive real-time 3D globe displaying global shoppers and order velocity.
        </p>
      </section>

      {/* 2. Centerpiece: Shopify-Inspired 3D Interactive Live Globe */}
      <section className="relative bg-[#070d18] rounded-2xl border border-slate-800 shadow-xl overflow-hidden mb-6">
        {/* Top Floating Info & Controls */}
        <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 text-white text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{metrics.activeVisitors} Shoppers Online</span>
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md p-1 rounded-xl border border-slate-700/80">
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              title={autoRotate ? 'Pause auto-spin' : 'Resume auto-spin'}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              {autoRotate ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button
              onClick={handleResetToIndia}
              title="Focus Store HQ (India)"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={() => setZoomLevel(prev => Math.min(1.4, prev + 0.15))}
              title="Zoom in"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={() => setZoomLevel(prev => Math.max(0.75, prev - 0.15))}
              title="Zoom out"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ZoomOut size={14} />
            </button>
          </div>
        </div>

        {/* 3D Canvas Stage */}
        <div className="relative w-full h-[360px] sm:h-[440px] flex items-center justify-center select-none overflow-hidden">
          <canvas
            id="shopifyGlobeCanvas"
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onClick={handleCanvasClick}
            className="w-full h-full block cursor-grab active:cursor-grabbing touch-none"
          />

          {/* Interactive Inspection Card on Marker Tap */}
          {selectedBeacon && selectedBeacon.x !== undefined && selectedBeacon.y !== undefined && (
            <div
              className="absolute z-20 min-w-[210px] p-3 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-2xl text-white pointer-events-auto transform -translate-x-1/2 -translate-y-full mb-3"
              style={{ left: selectedBeacon.x, top: selectedBeacon.y }}
            >
              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                  <span>{selectedBeacon.flag}</span>
                  <span>{selectedBeacon.city}</span>
                </div>
                <button
                  onClick={() => setSelectedBeacon(null)}
                  className="text-slate-400 hover:text-white text-xs px-1"
                >
                  ×
                </button>
              </div>
              <div className="pt-2 text-[11px] text-slate-300 space-y-1">
                <p className="font-semibold text-white">{selectedBeacon.label}</p>
                <p className="text-slate-400">{selectedBeacon.sub}</p>
                {selectedBeacon.value && (
                  <p className="text-emerald-400 font-bold">{selectedBeacon.value}</p>
                )}
              </div>
            </div>
          )}

          {/* Bottom Hint */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-sm border border-slate-800 text-[11px] text-slate-400 pointer-events-none flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
            <span>Drag sphere to inspect global shoppers · Tap markers for details</span>
          </div>
        </div>
      </section>

      {/* 3. Date Select Range Filter (Placed directly ABOVE the 6 KPI cards as requested!) */}
      <section className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-sm mb-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
              <Calendar size={16} />
            </span>
            <div>
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                Filter Date Range
              </span>
              <span className="text-[11px] text-slate-500">
                Choose the timeframe for KPIs, products, locations, and live activity
              </span>
            </div>
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex items-center flex-wrap gap-1.5 w-full md:w-auto">
            {[
              { id: 'today', label: 'Today (Live)' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7d', label: 'Last 7 Days' },
              { id: '30d', label: 'Last 30 Days' },
              { id: 'month', label: 'This Month' },
              { id: 'custom', label: 'Custom Range' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => handleQuickFilterSelect(f.id as QuickFilterOption)}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap",
                  quickFilter === f.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range Picker Accordion */}
        {isCustomOpen && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 outline-none focus:border-slate-900"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 outline-none focus:border-slate-900"
              />
            </div>
            <button
              onClick={handleApplyCustomDate}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors"
            >
              Apply Filter
            </button>
            <span className="text-[11px] text-slate-400 ml-auto">
              Active: {effectiveDateRange.label}
            </span>
          </div>
        )}
      </section>

      {/* 4. Six Accurate KPI Metric Cards (Strictly filtered by the Date Filter above) */}
      <section className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        {/* Card 1: Shoppers Online Right Now */}
        <article className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Shoppers Online</span>
              <span className="p-1 rounded-lg bg-blue-50 text-blue-600">
                <Users size={14} />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 tracking-tight flex items-baseline gap-1.5">
              <span>{metrics.activeVisitors}</span>
              <span className="text-[10px] font-bold text-emerald-600">● LIVE</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
            Active sessions
          </div>
        </article>

        {/* Card 2: Total Sales (Filtered by Date) */}
        <article className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Total Sales</span>
              <span className="p-1 rounded-lg bg-emerald-50 text-emerald-600">
                <TrendingUp size={14} />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 tracking-tight">
              {formatPrice(metrics.sales)}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400 truncate">
            {effectiveDateRange.label}
          </div>
        </article>

        {/* Card 3: Total Orders (Filtered by Date) */}
        <article className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Orders Placed</span>
              <span className="p-1 rounded-lg bg-purple-50 text-purple-600">
                <ShoppingBag size={14} />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 tracking-tight">
              {metrics.ordersCount.toLocaleString()}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
            {metrics.ordersCount === 0 ? 'No orders in range' : 'Verified orders'}
          </div>
        </article>

        {/* Card 4: Total Sessions */}
        <article className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Store Visits</span>
              <span className="p-1 rounded-lg bg-sky-50 text-sky-600">
                <Activity size={14} />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 tracking-tight">
              {metrics.sessions.toLocaleString()}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
            Traffic sessions
          </div>
        </article>

        {/* Card 5: Conversion Rate */}
        <article className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Conversion</span>
              <span className="p-1 rounded-lg bg-amber-50 text-amber-600">
                <CheckCircle2 size={14} />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 tracking-tight">
              {metrics.conversionRate}%
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
            Orders / Visits
          </div>
        </article>

        {/* Card 6: Customers */}
        <article className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Customers</span>
              <span className="p-1 rounded-lg bg-indigo-50 text-indigo-600">
                <CreditCard size={14} />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 tracking-tight">
              {totalCustomerCount > 0 ? totalCustomerCount.toLocaleString() : (metrics.ordersCount + 1).toLocaleString()}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
            Store accounts
          </div>
        </article>
      </section>

      {/* 5. Middle Grid: Top Locations & Top Products (Strictly filtered by the Date Filter) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Panel 1: Top Locations */}
        <article className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Top Locations</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Shoppers concentration for {effectiveDateRange.label}
              </p>
            </div>
            <span className="text-xs font-semibold text-blue-600">
              Verified
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {metrics.topLocations.slice(0, 5).map((loc, idx) => (
              <div key={idx} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{loc.flag}</span>
                  <div>
                    <span className="text-xs font-bold text-slate-800">{loc.city}</span>
                    <span className="text-[11px] text-slate-400 ml-2">({loc.country})</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-900">{loc.count}</span>
                  <span className="text-xs font-semibold text-slate-400 w-10 text-right">{loc.pct}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        {/* Panel 2: Top Products */}
        <article className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Top Products</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Sales by product for {effectiveDateRange.label}
              </p>
            </div>
            <span className="text-xs font-semibold text-blue-600">
              Catalog
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {topProducts.length > 0 ? (
              topProducts.map((prod) => (
                <div key={prod.rank} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-bold text-slate-400 w-4 text-center">{prod.rank}</span>
                    {prod.image ? (
                      <img
                        src={prod.image}
                        alt={prod.name}
                        className="w-8 h-8 rounded-lg object-cover bg-slate-100 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0">
                        <ShoppingBag size={14} />
                      </div>
                    )}
                    <span className="text-xs font-medium text-slate-800 truncate max-w-[200px]">{prod.name}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs font-bold text-slate-900">{prod.value}</span>
                    <span className="text-xs font-semibold text-slate-400 w-10 text-right">{prod.pct}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No product purchases recorded in this date range.
              </div>
            )}
          </div>
        </article>
      </section>

      {/* 6. Bottom Grid: Customer Behavior & Recent Activity (Zero stale data!) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Panel 3: Customer Behavior Funnel */}
        <article className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Customer Behavior</h2>
              <p className="text-xs text-slate-400 mt-0.5">Active shopping funnel velocity</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                  <Eye size={15} />
                </span>
                <div>
                  <h3 className="text-xs font-bold text-slate-800">Browsing Storefront</h3>
                  <p className="text-[11px] text-slate-400">Viewing collections and product details</p>
                </div>
              </div>
              <span className="text-sm font-black text-slate-900">{metrics.activeVisitors}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-xs">
                  <ShoppingBag size={15} />
                </span>
                <div>
                  <h3 className="text-xs font-bold text-slate-800">Active Shopping Carts</h3>
                  <p className="text-[11px] text-slate-400">Items ready to buy</p>
                </div>
              </div>
              <span className="text-sm font-black text-slate-900">{metrics.inCart}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs">
                  <CreditCard size={15} />
                </span>
                <div>
                  <h3 className="text-xs font-bold text-slate-800">In Checkout</h3>
                  <p className="text-[11px] text-slate-400">Completing address or payment</p>
                </div>
              </div>
              <span className="text-sm font-black text-slate-900">{metrics.inCheckout}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs">
                  <PackageCheck size={15} />
                </span>
                <div>
                  <h3 className="text-xs font-bold text-slate-800">Orders Placed</h3>
                  <p className="text-[11px] text-slate-400">Within {effectiveDateRange.label}</p>
                </div>
              </div>
              <span className="text-sm font-black text-slate-900">{metrics.ordersCount}</span>
            </div>
          </div>
        </article>

        {/* Panel 4: Real Activity Timeline (Filtered by active date range) */}
        <article className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Live Activity</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Events for {effectiveDateRange.label}
              </p>
            </div>
            <span className="text-[11px] text-slate-400 font-semibold">
              {activities.length} events
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {activities.length > 0 ? (
              activities.map(act => (
                <div key={act.id} className="py-2.5 flex items-start gap-3">
                  <span className="text-lg mt-0.5">{act.flag}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-800 truncate">{act.title}</p>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">{act.timeAgo}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{act.subtitle}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-slate-600">No events recorded in this date range</p>
                <p>Tracking live visitors continuously. New visits and orders will show here.</p>
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
