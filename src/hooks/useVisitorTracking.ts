import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useLocation } from 'react-router-dom';
import { auth } from '../firebase';

export const useVisitorTracking = () => {
  const location = useLocation();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Connect to Socket.io
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
    if (!socketRef.current) return;

    // Generate or get session ID
    let sessionId = sessionStorage.getItem('visitor_session_id');
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('visitor_session_id', sessionId);
    }

    const track = async () => {
      try {
        let city = 'Unknown';
        let country = 'Unknown';
        let lat = undefined;
        let lng = undefined;

        // Try geolocation first
        if ("geolocation" in navigator) {
          try {
            const pos = await new Promise<GeolocationPosition>((res, rej) => {
              navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 });
            });
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
          } catch (e) {}
        }

        // Fallback to IP if needed
        if (!lat) {
          try {
            const res = await fetch('https://ipapi.co/json/');
            const data = await res.json();
            city = data.city;
            country = data.country_name;
            lat = data.latitude;
            lng = data.longitude;
          } catch (e) {}
        }

        socketRef.current?.emit('visitor_tracking', {
          sessionId,
          userId: auth.currentUser?.uid,
          path: location.pathname,
          lat,
          lng,
          city,
          country
        });
      } catch (e) {
        console.error("Tracking failed", e);
      }
    };

    if (socketRef.current.connected) {
      track();
    } else {
      socketRef.current.on('connect', track);
    }

    return () => {
      socketRef.current?.off('connect', track);
    };
  }, [location.pathname]);
};
