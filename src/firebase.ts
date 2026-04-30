import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Set persistence globally with a fail-safe check
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      console.log("✅ Auth persistence set to local storage.");
    })
    .catch(err => {
      console.error("❌ Persistence failed:", err);
    });
}

// Use initializeFirestore with experimentalForceLongPolling to bypass potential WebSocket blockages
let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    ignoreUndefinedProperties: true,
  }, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  console.warn("⚠️ Firestore already initialized or failed, falling back to getFirestore");
  dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}
export const db = dbInstance;

export const storage = getStorage(app);
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

async function testConnection(retries = 3) {
  try {
    // Small delay to allow network to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("✅ Firestore connected successfully.");
  } catch (error) {
    if (retries > 0) {
      console.warn(`🔄 Firestore connection retry ${4 - retries}...`);
      await testConnection(retries - 1);
    } else {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error("❌ Firestore Error: Client is offline. Check your network or Firebase project status.");
      } else {
        console.warn("ℹ️ Firestore Reachability Probe:", error);
      }
    }
  }
}

if (typeof window !== 'undefined') {
  testConnection();
}
