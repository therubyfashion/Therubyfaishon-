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

  const app = admin.initializeApp(adminOptions, 'limit-checker');
  const db = getFirestore(app, dbId);

  try {
    const doc = await db.collection('system_stats').doc('communications').get();
    if (doc.exists) {
      console.log("=== COMMUNICATIONS STATS ===");
      console.log(JSON.stringify(doc.data(), null, 2));
    } else {
      console.log("No system_stats/communications document found.");
    }
  } catch (err) {
    console.error("Error reading system stats:", err.message);
  }
}

main();
