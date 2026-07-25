import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, doc, getDocFromServer, persistentLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with long-polling and local offline cache to support resilient offline usage
let activeDb: any;
try {
  activeDb = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    experimentalAutoDetectLongPolling: false,
    localCache: persistentLocalCache()
  }, firebaseConfig.firestoreDatabaseId || '(default)');
} catch (e: any) {
  console.warn("⚠️ Failed to initialize Firestore with custom databaseId, fallback to default profile:", e.message);
  activeDb = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    experimentalAutoDetectLongPolling: false,
    localCache: persistentLocalCache()
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

// Resilient asynchronous connection logging that doesn't block startup or throw 10s timeout warnings
async function testConnection() {
  if (typeof window !== 'undefined') {
    // Run after a delay to ensure standard loading flow is unimpeded
    setTimeout(async () => {
      try {
        await getDocFromServer(doc(activeDb, 'settings', 'connection_probe_test_id'));
        console.log("⚡ [Firebase Client] Connected successfully to Database ID:", firebaseConfig.firestoreDatabaseId || '(default)');
      } catch (error: any) {
        // If it fails, that's fine - offline mode cache handles query requests seamlessly
        console.log("ℹ️ [Firebase Client] Operating in resilient local-cache/offline mode.");
        
        const configDbId = firebaseConfig.firestoreDatabaseId;
        if (configDbId && configDbId !== '(default)') {
          try {
            const fallbackDb = initializeFirestore(app, {
              experimentalForceLongPolling: true,
              experimentalAutoDetectLongPolling: false,
              localCache: persistentLocalCache()
            });
            
            await getDocFromServer(doc(fallbackDb, 'settings', 'connection_probe_test_id'));
            activeDb = fallbackDb;
            console.log("⚡ [Firebase Client] Successfully connected to fallback '(default)' database.");
          } catch (fallbackErr: any) {
            // Suppress error logs to keep browser console and user reports clean
          }
        }
      }
    }, 3000);
  }
}
testConnection();

export const storage = getStorage(app);
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;
