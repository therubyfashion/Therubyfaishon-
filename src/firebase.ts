import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
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
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

export const storage = getStorage(app);
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("✅ Firestore connected successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("❌ Firestore Error: Please check your Firebase configuration or project permissions.");
    } else {
      // Ignore normal empty DB errors, just check for reachability
      console.warn("ℹ️ Firestore Initial Probe:", error);
    }
  }
}

if (typeof window !== 'undefined') {
  testConnection();
}
