import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';

export const useVisitorTracking = () => {
  const location = useLocation();
  const socketRef = useRef<Socket | null>(null);

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
    // Generate or get session ID
    let sessionId = sessionStorage.getItem('visitor_session_id');
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('visitor_session_id', sessionId);
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
              city: data.city || 'Unknown',
              country: data.country_name || 'Online',
              lat: data.latitude || 0,
              lng: data.longitude || 0,
              region: data.region || ''
            };
            sessionStorage.setItem('visitor_location', JSON.stringify(locationData));
          } catch (e) {
            locationData = { city: 'Online', country: 'Store', lat: 20, lng: 77 }; // Default India-ish for demo
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
            // Capitalize and format product slug or ID for presentation
            activeProduct = decodeURIComponent(parts[2]).replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          }
        }

        const trackingData = {
          id: sessionId,
          sessionId,
          userId: auth.currentUser?.uid || null,
          userEmail: auth.currentUser?.email || null,
          path: location.pathname,
          lastSeen: serverTimestamp(),
          startTime: sessionStorage.getItem('session_start_time') || new Date().toISOString(),
          browser: getBrowser(),
          device: getDevice(),
          activeProduct: activeProduct || null,
          ...locationData
        };

        if (!sessionStorage.getItem('session_start_time')) {
          sessionStorage.setItem('session_start_time', trackingData.startTime);
        }

        // 1. Send via Socket (for immediate server-side side-effects)
        socketRef.current?.emit('visitor_tracking', trackingData);

        // 2. Direct Firestore update for robust Admin view
        await setDoc(doc(db, 'active_sessions', sessionId), trackingData, { merge: true });

      } catch (e) {
        console.error("Tracking failed", e);
      }
    };

    track();
    
    // Heartbeat every 30 seconds
    const heartbeat = setInterval(track, 30000);

    // Initial setup on navigation
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
  }, [location.pathname, auth.currentUser]);

  // Clean up session on tab close (optional, but good for accuracy)
  useEffect(() => {
    const handleUnload = () => {
      const sessionId = sessionStorage.getItem('visitor_session_id');
      if (sessionId) {
        // Note: Navigator.sendBeacon or deleteDoc might not finish on unmount/unload
        // but we rely on the Admin view filtering by lastSeen for accuracy.
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);
};
