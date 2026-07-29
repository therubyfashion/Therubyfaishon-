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
    // Connect to Socket.io (Keep for socket-based events if needed)
    const socket = io(window.location.origin, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    // Generate or get session ID using localStorage
    let sessionId = localStorage.getItem('visitor_session_id');
    if (!sessionId) {
      sessionId = 'sess_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      localStorage.setItem('visitor_session_id', sessionId);
    }

    const track = async () => {
      try {
        // Try to get location via public API if not already in session
        let locationData = JSON.parse(sessionStorage.getItem('visitor_location') || 'null');
        
        if (!locationData) {
          try {
            const res = await fetch('https://ipapi.co/json/');
            const data = await res.json();
            locationData = {
              city: data.city || 'Delhi',
              country: data.country_name || 'India',
              lat: data.latitude || 28.6139,
              lng: data.longitude || 77.2090,
              region: data.region || ''
            };
            sessionStorage.setItem('visitor_location', JSON.stringify(locationData));
          } catch (e) {
            locationData = { city: 'Delhi', country: 'India', lat: 28.6139, lng: 77.2090 };
          }
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
        const { error: upsertErr } = await supabase
          .from('active_sessions')
          .upsert(trackingData, { onConflict: 'session_id' });

        if (upsertErr) {
          console.warn("Supabase active_sessions upsert warning:", upsertErr.message);
        }

        // Clean up stale sessions (> 10 mins)
        const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        await supabase
          .from('active_sessions')
          .delete()
          .lt('last_seen', tenMinsAgo);

      } catch (e) {
        console.error("Tracking failed", e);
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
