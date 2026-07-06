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

  const app = admin.initializeApp(adminOptions, 'collections-checker');
  const db = getFirestore(app, dbId);

  try {
    const collections = await db.listCollections();
    console.log("=== FIRESTORE COLLECTIONS ===");
    for (const coll of collections) {
      console.log(`Collection: ${coll.id}`);
      if (coll.id === 'templates' || coll.id === 'email_templates' || coll.id === 'settings') {
        const snap = await coll.limit(5).get();
        snap.forEach(doc => {
          console.log(`  Doc ID: ${doc.id}`);
          console.log(`  Data:`, JSON.stringify(doc.data(), null, 2));
        });
      }
    }
  } catch (err) {
    console.error("Error listing collections:", err.message);
  }
}

main();
