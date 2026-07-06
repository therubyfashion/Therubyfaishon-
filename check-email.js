import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
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

  const app = admin.initializeApp(adminOptions, 'email-checker');
  const db = getFirestore(app, dbId);

  try {
    const settingsSnap = await db.collection('settings').get();
    let smtpUser, smtpPass;
    settingsSnap.forEach(doc => {
      const data = doc.data();
      smtpUser = data.smtpUser;
      smtpPass = data.smtpPass;
    });

    if (!smtpUser || !smtpPass) {
      console.error("SMTP credentials not found in settings!");
      return;
    }

    console.log(`Testing SMTP with user: ${smtpUser} and pass length: ${smtpPass.length}`);

    const cleanUser = String(smtpUser).trim();
    const cleanPass = String(smtpPass).replace(/\s/g, '');

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: cleanUser,
        pass: cleanPass
      }
    });

    console.log("Sending test email...");
    const result = await transporter.sendMail({
      from: `"The Ruby" <${cleanUser}>`,
      to: "mdsagaransari65670@gmail.com",
      subject: "Test Email from SMTP Diagnostic",
      html: "<p>This is a test email to verify SMTP functionality.</p>"
    });

    console.log("✅ GMAIL SENT SUCCESSFULLY:", result.messageId);
  } catch (err) {
    console.error("❌ SMTP ERROR ENCOUNTERED:", err);
  }
}

main();
