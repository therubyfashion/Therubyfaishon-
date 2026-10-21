import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useLocation } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';

export const useVisitorTracking = () => {
  const location = useLocation();
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuth();
  const { total: cartTotal } = useCart();

  useEffect(() => {
    // Connect to Socket.io with websocket & polling fallback
    const socket = io(window.location.origin, {
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    // Generate or get session ID using localStorage
    let sessionId: string | null = null;
    try {
      sessionId = localStorage.getItem('visitor_session_id');
      if (!sessionId) {
        sessionId = 'sess_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
        try {
          localStorage.setItem('visitor_session_id', sessionId);
        } catch (e) {
          Object.keys(localStorage)
            .filter(k => k.startsWith('ruby_product_cache_'))
            .forEach(k => { try { localStorage.removeItem(k); } catch {} });
          try {
            localStorage.setItem('visitor_session_id', sessionId);
          } catch {
            // Silent fail
          }
        }
      }
    } catch {
      sessionId = 'sess_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
    }

    const track = async () => {
      try {
        // Fetch real geographic location (server lookup first, fallback to ipwho.is)
        let locationData = JSON.parse(sessionStorage.getItem('visitor_location') || 'null');
        
        if (!locationData || locationData.city === 'Delhi' || !locationData.lat) {
          try {
            // 1. Try server-side geo IP lookup
            const res = await fetch('/api/geo/lookup');
            if (res.ok) {
              const data = await res.json();
              if (data && data.city && data.lat && data.lng) {
                locationData = {
                  city: data.city,
                  country: data.country || 'India',
                  lat: Number(data.lat),
                  lng: Number(data.lng),
                  region: data.region || ''
                };
              }
            }
          } catch {}

          // 2. Fallback to free, reliable CORS-enabled ipwho.is if server lookup didn't return city/coords
          if (!locationData || !locationData.city || locationData.city === 'Delhi') {
            try {
              const res2 = await fetch('https://ipwho.is/');
              if (res2.ok) {
                const data2 = await res2.json();
                if (data2 && data2.success !== false && data2.city) {
                  locationData = {
                    city: data2.city,
                    country: data2.country || 'India',
                    lat: Number(data2.latitude) || 28.6139,
                    lng: Number(data2.longitude) || 77.2090,
                    region: data2.region || ''
                  };
                }
              }
            } catch {}
          }

          // 3. Fallback default
          if (!locationData) {
            locationData = { city: 'New Delhi', country: 'India', lat: 28.6139, lng: 77.2090 };
          }
          sessionStorage.setItem('visitor_location', JSON.stringify(locationData));
        }

        const getBrowser = (): string => {
          const ua = navigator.userAgent;
          if (ua.includes('Chrome') && !ua.includes('Chromium') && !ua.includes('Edg')) return 'Chrome';
          if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
          if (ua.includes('Firefox')) return 'Firefox';
          if (ua.includes('Edg')) return 'Edge';
          if (/Mobi|Android|iPhone/i.test(ua)) return 'Mobile Browser';
          return 'Desktop Browser';
        };

        const getDevice = (): string => {
          const ua = navigator.userAgent;
          if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) {
            if (/iPhone/i.test(ua)) return 'iPhone';
            if (/iPad/i.test(ua)) return 'iPad';
            return 'Android';
          }
          return 'Desktop';
        };

        // Parse product name from path if applicable (e.g. /product/product-id)
        let activeProduct = '';
        if (location.pathname.startsWith('/product/')) {
          const parts = location.pathname.split('/');
          if (parts[2]) {
            activeProduct = decodeURIComponent(parts[2]).replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          }
        }

        const startTime = sessionStorage.getItem('session_start_time') || new Date().toISOString();
        if (!sessionStorage.getItem('session_start_time')) {
          sessionStorage.setItem('session_start_time', startTime);
        }

        const trackingData = {
          session_id: sessionId,
          user_id: user?.id || (user as any)?.uid || null,
          page: location.pathname,
          city: locationData.city || 'Delhi',
          country: locationData.country || 'India',
          device: getDevice(),
          cart_value: Number(cartTotal) || 0,
          product_viewed: activeProduct || null,
          last_seen: new Date().toISOString(),
          created_at: startTime
        };

        // Send via Socket
        socketRef.current?.emit('visitor_tracking', {
          id: sessionId,
          sessionId,
          path: location.pathname,
          ...trackingData
        });

        // Insert or Upsert into Supabase active_sessions table
        try {
          const { error } = await supabase
            .from('active_sessions')
            .upsert(trackingData, { onConflict: 'session_id' });

          if (error) {
            // Silent fail — visitor tracking is non-critical
            return;
          }

          // Clean up stale sessions (> 10 mins)
          const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
          await supabase
            .from('active_sessions')
            .delete()
            .lt('last_seen', tenMinsAgo);
        } catch {
          // Silent fail
        }

      } catch {
        // Silent fail — visitor tracking is non-critical
      }
    };

    track();
    
    // Heartbeat every 20 seconds
    const heartbeat = setInterval(track, 20000);

    if (socketRef.current) {
      if (socketRef.current.connected) {
        track();
      } else {
        socketRef.current.on('connect', track);
      }
    }

    return () => {
      clearInterval(heartbeat);
      socketRef.current?.off('connect', track);
    };
  }, [location.pathname, user, cartTotal]);

  // Clean up session on tab close/unload
  useEffect(() => {
    const handleUnload = () => {
      const sessionId = localStorage.getItem('visitor_session_id');
      if (sessionId) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseKey) {
          const url = `${supabaseUrl}/rest/v1/active_sessions?session_id=eq.${sessionId}`;
          fetch(url, {
            method: 'DELETE',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            },
            keepalive: true
          }).catch(() => {});
        }
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);
};
