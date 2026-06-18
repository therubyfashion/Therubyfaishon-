import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Center-aligned session cleanup interceptor for resilient developer testing
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
  
  const originalSignOut = auth.signOut.bind(auth);
  auth.signOut = async () => {
    localStorage.removeItem('ruby_local_user');
    localStorage.removeItem('phone_user');
    return originalSignOut();
  };
}

// Initialize Firestore with long-polling to prevent WebSocket connection failures inside browser iframes
let activeDb: any;
try {
  activeDb = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    experimentalAutoDetectLongPolling: false
  }, firebaseConfig.firestoreDatabaseId || '(default)');
} catch (e: any) {
  console.warn("⚠️ Failed to initialize Firestore with custom databaseId, fallback to default profile:", e.message);
  activeDb = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    experimentalAutoDetectLongPolling: false
  });
}

// Transparent Proxy wrapper to support dynamic runtime database fallback
export const db = new Proxy(activeDb, {
  get(target, prop, receiver) {
    const value = Reflect.get(activeDb, prop);
    if (typeof value === 'function') {
      return value.bind(activeDb);
    }
    return value;
  },
  set(target, prop, value, receiver) {
    return Reflect.set(activeDb, prop, value);
  }
});

// Connection Verification Probe on App Initiation with Auto-Fallback
async function testConnection() {
  if (typeof window !== 'undefined') {
    try {
      // Fetch a sample document from the settings collection using getDocFromServer
      await getDocFromServer(doc(activeDb, 'settings', 'connection_probe_test_id'));
      console.log("⚡ [Firebase Client] Connected successfully to Database ID:", firebaseConfig.firestoreDatabaseId || '(default)');
    } catch (error: any) {
      console.warn("⚠️ [Firebase Client] Configured database connection failed. Dynamic fallback to '(default)' initiated. Error:", error.message || error);
      
      const configDbId = firebaseConfig.firestoreDatabaseId;
      if (configDbId && configDbId !== '(default)') {
        try {
          const fallbackDb = initializeFirestore(app, {
            experimentalForceLongPolling: true,
            experimentalAutoDetectLongPolling: false
          }); // Defaults to (default)
          
          await getDocFromServer(doc(fallbackDb, 'settings', 'connection_probe_test_id'));
          activeDb = fallbackDb;
          console.log("⚡ [Firebase Client] Successfully connected to fallback '(default)' database.");
        } catch (fallbackErr: any) {
          console.error("❌ [Firebase Client] Fallback to '(default)' database also failed:", fallbackErr.message || fallbackErr);
        }
      }
    }
  }
}
testConnection();

export const storage = getStorage(app);
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;
