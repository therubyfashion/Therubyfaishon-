import { useEffect } from 'react';
import { collection, doc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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
        // Try ipapi.co first
        let data;
        try {
          const response = await fetch('https://ipapi.co/json/');
          if (response.ok) {
            data = await response.json();
          }
        } catch (e) {
          console.warn('ipapi.co failed, trying fallback...');
        }

        // Fallback to ip-api.com (very accurate)
        if (!data || data.error) {
          try {
            const response = await fetch('http://ip-api.com/json/');
            if (response.ok) {
              const rawData = await response.json();
              if (rawData.status === 'success') {
                data = {
                  city: rawData.city,
                  region: rawData.regionName,
                  country_name: rawData.country,
                  latitude: rawData.lat,
                  longitude: rawData.lon
                };
              }
            }
          } catch (e) {
            console.warn('ip-api.com failed, trying next fallback...');
          }
        }

        // Fallback to freeipapi.com if others failed
        if (!data || data.error) {
          const response = await fetch('https://freeipapi.com/api/json');
          if (response.ok) {
            const rawData = await response.json();
            data = {
              city: rawData.cityName,
              region: rawData.regionName,
              country_name: rawData.countryName,
              latitude: rawData.latitude,
              longitude: rawData.longitude
            };
          }
        }

        if (!data) throw new Error('All IP tracking services failed');

        const sessionRef = doc(db, 'active_sessions', sessionId!);
        await setDoc(sessionRef, {
          id: sessionId,
          city: data.city || 'Unknown',
          region: data.region || 'Unknown',
          country: data.country_name || 'Unknown',
          lat: data.latitude,
          lng: data.longitude,
          lastSeen: serverTimestamp(),
          userAgent: navigator.userAgent,
          path: window.location.pathname
        }).catch(e => handleFirestoreError(e, OperationType.WRITE, `active_sessions/${sessionId}`));
      } catch (error) {
        // Only log if it's not a common fetch error (like adblockers)
        if (error instanceof Error && !error.message.includes('Failed to fetch')) {
          console.error('Error tracking visitor:', error);
        }
        
        // Fallback without location if IP tracking fails
        const sessionRef = doc(db, 'active_sessions', sessionId!);
        await setDoc(sessionRef, {
          id: sessionId,
          city: 'Unknown',
          country: 'Unknown',
          lastSeen: serverTimestamp(),
          path: window.location.pathname
        }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.WRITE, `active_sessions/${sessionId}`));
      }
    };

    trackVisitor();

    // Heartbeat every 30 seconds
    const interval = setInterval(async () => {
      const sessionRef = doc(db, 'active_sessions', sessionId!);
      await setDoc(sessionRef, {
        lastSeen: serverTimestamp(),
        path: window.location.pathname
      }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.WRITE, `active_sessions/${sessionId}`));
    }, 30000);

    // Cleanup on unmount
    return () => {
      clearInterval(interval);
      const cleanup = async () => {
        try {
          await deleteDoc(doc(db, 'active_sessions', sessionId!)).catch(e => handleFirestoreError(e, OperationType.DELETE, `active_sessions/${sessionId}`));
        } catch (e) {
          console.error('Cleanup error:', e);
        }
      };
      cleanup();
    };
  }, []);
};
