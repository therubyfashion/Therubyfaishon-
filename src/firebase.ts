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
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);

// Connection Verification Probe on App Initiation
async function testConnection() {
  if (typeof window !== 'undefined') {
    try {
      // Fetch a sample document from the settings collection using getDocFromServer
      await getDocFromServer(doc(db, 'settings', 'connection_probe_test_id'));
      console.log("⚡ [Firebase Client] Connected successfully to Database ID:", firebaseConfig.firestoreDatabaseId);
    } catch (error: any) {
      console.warn("⚠️ [Firebase Client] Initialization connectivity check result:", error.message || error);
    }
  }
}
testConnection();

export const storage = getStorage(app);
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;
