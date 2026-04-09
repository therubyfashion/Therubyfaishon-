import { useEffect } from 'react';
import { collection, doc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const useVisitorTracking = () => {
  useEffect(() => {
    // Generate or get session ID
    let sessionId = sessionStorage.getItem('visitor_session_id');
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('visitor_session_id', sessionId);
    }

    const trackVisitor = async () => {
      try {
        // Get location data from IP
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();

        if (data.error) throw new Error(data.reason);

        const sessionRef = doc(db, 'active_sessions', sessionId!);
        await setDoc(sessionRef, {
          id: sessionId,
          city: data.city || 'Unknown',
          country: data.country_name || 'Unknown',
          lat: data.latitude,
          lng: data.longitude,
          lastSeen: serverTimestamp(),
          userAgent: navigator.userAgent,
          path: window.location.pathname
        });
      } catch (error) {
        console.error('Error tracking visitor:', error);
        // Fallback without location if IP tracking fails
        const sessionRef = doc(db, 'active_sessions', sessionId!);
        await setDoc(sessionRef, {
          id: sessionId,
          city: 'Unknown',
          country: 'Unknown',
          lastSeen: serverTimestamp(),
          path: window.location.pathname
        }, { merge: true });
      }
    };

    trackVisitor();

    // Heartbeat every 30 seconds
    const interval = setInterval(async () => {
      const sessionRef = doc(db, 'active_sessions', sessionId!);
      await setDoc(sessionRef, {
        lastSeen: serverTimestamp(),
        path: window.location.pathname
      }, { merge: true });
    }, 30000);

    // Cleanup on unmount
    return () => {
      clearInterval(interval);
      const cleanup = async () => {
        try {
          await deleteDoc(doc(db, 'active_sessions', sessionId!));
        } catch (e) {
          console.error('Cleanup error:', e);
        }
      };
      cleanup();
    };
  }, []);
};
