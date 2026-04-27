import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { auth } from '../firebase';

export const useVisitorTracking = () => {
  useEffect(() => {
    // Connect to Socket.io
    const socket = io(window.location.origin, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Generate or get session ID
    let sessionId = sessionStorage.getItem('visitor_session_id');
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('visitor_session_id', sessionId);
    }

    const getLocationData = async () => {
      // 1. Try GPS first if browser supports it
      if ("geolocation" in navigator) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { 
              timeout: 5000,
              enableHighAccuracy: false
            });
          });
          
          return {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: 'high'
          };
        } catch (e) {
          console.log("GPS access denied or timed out, falling back to IP...");
        }
      }

      // 2. Fallback to IP-based location APIs
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
          const data = await res.json();
          return {
            lat: data.latitude,
            lng: data.longitude,
            city: data.city,
            country: data.country_name,
            accuracy: 'low'
          };
        }
      } catch (e) {
        console.warn("IP tracking failed");
      }
      return null;
    };

    const track = async () => {
      if (socket.connected) {
        const loc = await getLocationData();
        socket.emit('visitor_tracking', {
          sessionId,
          userId: auth.currentUser?.uid,
          path: window.location.pathname,
          lat: loc?.lat,
          lng: loc?.lng,
          city: loc?.city,
          country: loc?.country
        });
      }
    };

    socket.on('connect', track);

    // Track path changes
    const originalPushState = window.history.pushState;
    window.history.pushState = function() {
      // @ts-ignore
      originalPushState.apply(this, arguments);
      track();
    };

    // Handle session end on unmount
    return () => {
      window.history.pushState = originalPushState;
      socket.disconnect();
    };
  }, []);
};
