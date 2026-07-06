import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

async function main() {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    console.error("firebase-applet-config.json not found!");
    return;
  }
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const targetProjectId = firebaseConfig.projectId;
  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';

  const adminOptions = { projectId: targetProjectId };
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    adminOptions.credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    });
  } else {
    adminOptions.credential = admin.credential.applicationDefault();
  }

  const app = admin.initializeApp(adminOptions, 'order-checker');
  const db = getFirestore(app, dbId);

  try {
    const ordersSnap = await db.collection('orders').orderBy('createdAt', 'desc').limit(3).get();
    console.log(`=== LATEST ORDERS ===`);
    ordersSnap.forEach(doc => {
      const data = doc.data();
      console.log(`Order ID: ${data.orderId}`);
      console.log(`Customer: ${data.customerName}`);
      console.log(`Email: ${data.email}`);
      console.log(`Address Email: ${data.address?.email}`);
      console.log(`Total: ${data.total}`);
      console.log(`CreatedAt: ${data.createdAt}`);
      console.log(`-----------------------------------`);
    });
  } catch (err) {
    console.error("Error fetching orders:", err.message);
  }
}

main();
