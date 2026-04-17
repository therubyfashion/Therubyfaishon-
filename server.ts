import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Resend } from 'resend';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import axios from 'axios';
import * as OneSignal from 'onesignal-node';

dotenv.config();

// Initialize OneSignal
let oneSignalClient: any = null;

// Initialize Firebase Admin for server-side operations
let db: any = null;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  let firestoreDatabaseId = '(default)';

  if (fs.existsSync(configPath)) {
    try {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      firestoreDatabaseId = firebaseConfig.firestoreDatabaseId || firestoreDatabaseId;
    } catch (e) {
      console.warn("Could not parse firebase-applet-config.json:", e);
    }
  }
    
  // Initialize Admin SDK
  // In AI Studio/Cloud Run, calling initializeApp() without arguments is the most reliable way 
  // to use the environment's default service account and project ID.
  const adminApp = !admin.apps.length ? admin.initializeApp() : admin.app();
  const actualProjectId = adminApp.options.projectId || process.env.PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;

  console.log("Firebase Admin initialized. Project:", actualProjectId, "DB ID:", firestoreDatabaseId);

  // Use getFirestore from firebase-admin/firestore with the app instance
  try {
    if (firestoreDatabaseId && firestoreDatabaseId !== '(default)') {
      db = getFirestore(adminApp, firestoreDatabaseId);
    } else {
      db = getFirestore(adminApp);
    }
    // Verify connection immediately
    db.collection('settings').limit(1).get()
      .then(() => console.log("Successfully connected to Firestore collection 'settings'"))
      .catch((e: any) => console.warn("Initial Firestore test failed (this is normal if collection is empty or if still provisioning):", e.message));
  } catch (dbErr) {
    console.error("Failed to initialize specific Firestore database, falling back to default:", dbErr);
    db = getFirestore(adminApp);
  }
} catch (err) {
  console.error("Failed to initialize Firebase Admin on server:", err);
}

// Helper to send OneSignal notifications via axios
async function sendOneSignalNotification(notification: any) {
  let appId = (process.env.ONESIGNAL_APP_ID || process.env.VITE_ONESIGNAL_APP_ID || '').trim();
  let restKey = (process.env.ONESIGNAL_REST_API_KEY || '').trim();

  const isPlaceholder = (val: string) => !val || val === 'dummy-id' || val === 'YOUR_ONESIGNAL_APP_ID' || val === 'placeholder';

  // If not in env or seems to be a placeholder, try to fetch from Firestore
  if (isPlaceholder(appId) || isPlaceholder(restKey)) {
    if (db) {
      try {
        console.log("OneSignal configuration missing in env, attempting to fetch from Firestore 'settings'...");
        const settingsSnap = await db.collection('settings').limit(1).get();
        if (!settingsSnap.empty) {
          const settings = settingsSnap.docs[0].data();
          if (settings.oneSignalAppId && settings.oneSignalRestApiKey) {
            appId = settings.oneSignalAppId.trim();
            restKey = settings.oneSignalRestApiKey.trim();
            console.log("OneSignal config successfully loaded from Firestore.");
          }
        } else {
          console.warn("OneSignal config fetch: 'settings' collection found but is empty.");
        }
      } catch (e: any) {
        console.error("Failed to fetch OneSignal settings from DB:", e.message);
        if (e.message.includes('permission') || e.message.includes('7')) {
          console.warn("Detected permission issue. This often happens if the project ID in firebase-applet-config.json is stale or if the service account lacks access to the named database.");
          // Attempt a one-time fallback to default database if we were using a named one
          try {
             console.log("Attempting fallback to default Firestore database...");
             const defaultDb = getFirestore();
             const fallbackSnap = await defaultDb.collection('settings').limit(1).get();
             if (!fallbackSnap.empty) {
                const settings = fallbackSnap.docs[0].data();
                appId = settings.oneSignalAppId?.trim() || appId;
                restKey = settings.oneSignalRestApiKey?.trim() || restKey;
                console.log("OneSignal config loaded from default database fallback.");
             }
          } catch (fallbackErr: any) {
             console.error("Fallback attempt failed:", fallbackErr.message);
          }
        }
      }
    }
  }

  if (isPlaceholder(appId) || isPlaceholder(restKey)) {
    throw new Error("OneSignal is not configured. Please add ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY to 'Secrets' in AI Studio Settings, or configure them in the Admin Panel.");
  }

  return await axios.post('https://onesignal.com/api/v1/notifications', 
    { ...notification, app_id: appId },
    { headers: { 'Authorization': `Basic ${restKey}`, 'Content-Type': 'application/json' } }
  );
}

// Cache for store settings to avoid frequent Firestore calls
let cachedSettings: any = null;
let lastSettingsFetch = 0;
const SETTINGS_CACHE_TTL = 60000; // 1 minute

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let currentResendApiKey = process.env.RESEND_API_KEY;
let resend = new Resend(currentResendApiKey);

let razorpay: Razorpay | null = null;
const initialKeyId = (process.env.VITE_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_ID)?.trim();
const initialKeySecret = (process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET_KEY || process.env.RAZORPAY_SECRET)?.trim();

if (initialKeyId && initialKeySecret) {
  razorpay = new Razorpay({
    key_id: initialKeyId,
    key_secret: initialKeySecret,
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // API routes
  app.get("/api/firebase-status", async (req, res) => {
    try {
      if (!db) throw new Error("Firebase Admin not initialized");
      await db.collection('settings').limit(1).get();
      res.json({ success: true, status: "Connected" });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/config", (req, res) => {
    const { resendApiKey, razorpayKeyId, razorpayKeySecret, oneSignalAppId, oneSignalRestApiKey } = req.body;
    
    if (resendApiKey) {
      currentResendApiKey = resendApiKey;
      resend = new Resend(currentResendApiKey);
      console.log("Resend API Key updated");
    }

    if (razorpayKeyId && razorpayKeySecret) {
      razorpay = new Razorpay({
        key_id: razorpayKeyId.trim(),
        key_secret: razorpayKeySecret.trim(),
      });
      // Store in process.env for the diagnostic endpoint and other logic
      process.env.VITE_RAZORPAY_KEY_ID = razorpayKeyId.trim();
      process.env.RAZORPAY_KEY_SECRET = razorpayKeySecret.trim();
      console.log("Razorpay Keys updated via Admin Panel");
    }

    if (oneSignalAppId && oneSignalRestApiKey) {
      oneSignalClient = new OneSignal.Client(oneSignalAppId.trim(), oneSignalRestApiKey.trim());
      process.env.ONESIGNAL_APP_ID = oneSignalAppId.trim();
      process.env.ONESIGNAL_REST_API_KEY = oneSignalRestApiKey.trim();
      console.log("OneSignal Keys updated via Admin Panel");
    }

    res.json({ status: "ok" });
  });

  app.get("/api/debug-auth", (req, res) => {
    res.json({
      serverSide: {
        hasDb: !!db,
        projectId: admin.apps.length > 0 ? admin.apps[0].options.projectId : 'not-init',
        nodeEnv: process.env.NODE_ENV
      }
    });
  });

  app.get("/api/payment-config", async (req, res) => {
    const vId = process.env.VITE_RAZORPAY_KEY_ID;
    const rId = process.env.RAZORPAY_KEY_ID;
    const rKey = process.env.RAZORPAY_ID;
    
    let keyId = (vId || rId || rKey)?.trim();
    let hasSecret = !!(process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET_KEY || process.env.RAZORPAY_SECRET);

    // Fallback to Firestore
    if (!keyId && db) {
      try {
        const settingsSnap = await db.collection('settings').get();
        if (!settingsSnap.empty) {
          const settings = settingsSnap.docs[0].data();
          keyId = settings.razorpayKeyId;
          hasSecret = !!settings.razorpayKeySecret;
        }
      } catch (err) {
        console.error("Error fetching settings for config:", err);
      }
    }
    
    // Diagnostic info
    console.log("Payment Config Request:", {
      foundKey: !!keyId,
      foundSecret: hasSecret
    });

    res.json({ 
      razorpayKeyId: keyId || null,
      diagnostics: {
        serverHasViteKey: !!keyId,
        serverHasSecretKey: hasSecret
      }
    });
  });

  app.post("/api/create-razorpay-order", async (req, res) => {
    // Check for both prefixed and non-prefixed versions, and common variations
    let keyId = (process.env.VITE_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_ID)?.trim();
    let keySecret = (process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET_KEY || process.env.RAZORPAY_SECRET)?.trim();

    // Fallback: Try to load from Firestore if missing
    if ((!keyId || !keySecret) && db) {
      try {
        console.log("Keys missing in env, attempting to load from Firestore...");
        const settingsSnap = await db.collection('settings').get();
        if (!settingsSnap.empty) {
          const settings = settingsSnap.docs[0].data();
          if (settings.razorpayKeyId && settings.razorpayKeySecret) {
            keyId = settings.razorpayKeyId.trim();
            keySecret = settings.razorpayKeySecret.trim();
            console.log("Loaded Razorpay keys from Firestore");
          }
        }
      } catch (err) {
        console.error("Error loading settings from Firestore:", err);
      }
    }

    if (!keyId || !keySecret) {
      console.error("Razorpay keys missing in environment. Available env keys:", Object.keys(process.env).filter(k => k.includes('RAZORPAY')));
      return res.status(500).json({ 
        error: "Razorpay API is not configured on the server. Please ensure you have added VITE_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your Secrets in AI Studio, and then click 'Deploy' to apply the changes." 
      });
    }

    // Always create a fresh instance or update if keys changed
    if (!razorpay || (razorpay as any).key_id !== keyId) {
      razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
    }

    const { amount, currency, receipt } = req.body;

    try {
      const order = await razorpay.orders.create({
        amount, // amount in the smallest currency unit
        currency,
        receipt,
      });
      res.json(order);
    } catch (error: any) {
      console.error("Razorpay order creation error:", error);
      res.status(500).json({ error: error.message || "Failed to create Razorpay order" });
    }
  });

  app.post("/api/delete-user", async (req, res) => {
    const { uid } = req.body;
    if (!uid) {
      return res.status(400).json({ error: "Missing uid" });
    }

    try {
      await admin.auth().deleteUser(uid);
      res.json({ status: "ok", message: "User deleted from Auth" });
    } catch (error: any) {
      console.error("Error deleting user from Auth:", error);
      res.status(500).json({ error: error.message || "Failed to delete user from Auth" });
    }
  });

  app.post("/api/send-email", async (req, res) => {
    const { to, subject, html, from, fromName: providedFromName } = req.body;
    const apiKey = process.env.RESEND_API_KEY || currentResendApiKey;
    
    if (!to || !subject || !html) {
      return res.status(400).json({ error: "Missing required fields: to, subject, or html" });
    }

    if (!apiKey) {
      return res.status(400).json({ error: "Email service not configured." });
    }

    try {
      const dynamicResend = new Resend(apiKey);
      
      // Use provided fromName or fallback to cached/default
      let fromName = providedFromName || 'The Ruby';
      
      if (!providedFromName) {
        try {
          const now = Date.now();
          if (!cachedSettings || (now - lastSettingsFetch > SETTINGS_CACHE_TTL)) {
            if (db) {
              const settingsSnap = await db.collection('settings').limit(1).get();
              if (!settingsSnap.empty) {
                cachedSettings = settingsSnap.docs[0].data();
                lastSettingsFetch = now;
              }
            }
          }
          if (cachedSettings?.storeName) fromName = cachedSettings.storeName;
        } catch (e) {
          console.error("Silent error fetching settings:", e);
        }
      }

      const emailPayload = {
        from: from || process.env.RESEND_FROM_EMAIL || `"${fromName}" <onboarding@therubyfashion.shop>`,
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: html,
      };

      console.log("--- Email Sending Start ---");
      console.log("To:", to);
      console.log("From:", emailPayload.from);
      
      if (!apiKey || apiKey.trim() === '') {
        console.error("RESEND_API_KEY is empty or invalid.");
        return res.status(400).json({ error: "Email API key is not configured correctly." });
      }

      const { data, error } = await dynamicResend.emails.send(emailPayload);
      
      if (error) {
        console.error("Resend API Error Details:", JSON.stringify(error, null, 2));
        let errorMessage = error.message || "Resend failed to send email";
        
        if (errorMessage.includes("domain is not verified") || errorMessage.includes("Sender not authorized")) {
          errorMessage = `Bhai, Resend keh raha hai ki "${emailPayload.from}" authorized nahi hai. 
          1. Check karein ki aapne Resend mein domain verify kiya hai.
          2. AI Studio Secrets mein "RESEND_FROM_EMAIL" add karein (e.g., info@yourdomain.com).`;
        }

        return res.status(400).json({ 
          error: errorMessage,
          details: error
        });
      }
      
      console.log("--- Email Sent Successfully ---", data?.id);
      res.json(data);
    } catch (error: any) {
      console.error("Server-side email error:", error);
      res.status(500).json({ error: error.message || "Internal server error while sending email" });
    }
  });

  app.post("/api/send-push", async (req, res) => {
    const { title, body, url, type } = req.body;
    
    try {
      console.log("OneSignal: Sending broadcast notification...");
      
      const notification = {
        contents: {
          en: body,
        },
        headings: {
          en: title,
        },
        url: url || '/',
        included_segments: type === 'all' ? ['All'] : (type === 'active' ? ['Active Users'] : ['Subscribed Users']),
      };

      const response = await sendOneSignalNotification(notification);
      console.log("OneSignal notification sent:", response.data);
      res.json({ success: true, id: response.data.id });
    } catch (error: any) {
      console.error("OneSignal error:", error.response?.data || error.message);
      res.status(500).json({ 
        error: error.message,
        details: "Bhai, OneSignal App ID aur API Key check karein settings mein."
      });
    }
  });

  // Send notification to specific user (for order updates)
  app.post("/api/send-user-push", async (req, res) => {
    const { userId, title, body, url } = req.body;
    
    try {
      console.log(`OneSignal: Sending notification to user ${userId}...`);
      
      const notification = {
        contents: {
          en: body,
        },
        headings: {
          en: title,
        },
        url: url || '/',
        filters: [
          { field: "tag", key: "userId", relation: "=", value: userId }
        ],
      };

      const response = await sendOneSignalNotification(notification);
      res.json({ success: true, id: response.data.id });
    } catch (error: any) {
      console.error("OneSignal user notification error:", error.response?.data || error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Send notification to admins (for new orders)
  app.post("/api/send-admin-push", async (req, res) => {
    const { title, body, url } = req.body;
    
    try {
      console.log("OneSignal: Sending notification to admins...");
      
      const notification = {
        contents: {
          en: body,
        },
        headings: {
          en: title,
        },
        url: url || '/',
        filters: [
          { field: "tag", key: "role", relation: "=", value: "admin" }
        ],
      };

      const response = await sendOneSignalNotification(notification);
      res.json({ success: true, id: response.data.id });
    } catch (error: any) {
      console.error("OneSignal admin notification error:", error.response?.data || error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/test-onesignal", async (req, res) => {
    try {
      // Get keys from request body or env
      const appId = (req.body.appId || process.env.ONESIGNAL_APP_ID)?.trim();
      const restKey = (req.body.restKey || process.env.ONESIGNAL_REST_API_KEY)?.trim();

      if (!appId || !restKey || appId === 'dummy-id') {
        return res.status(400).json({ 
          success: false, 
          error: "OneSignal App ID or REST API Key is missing.",
          details: "Bhai, App ID aur REST API Key enter karein, phir test karein."
        });
      }

      console.log(`Testing OneSignal with App ID: ${appId}`);

      // Direct axios call to verify keys
      const response = await axios.get(`https://onesignal.com/api/v1/players?app_id=${appId}&limit=1`, {
        headers: {
          'Authorization': `Basic ${restKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      res.json({ 
        success: true, 
        message: "OneSignal configuration is valid! ✅", 
        data: response.data 
      });
    } catch (error: any) {
      console.error("OneSignal test error:", error.response?.data || error.message);
      
      const apiErrors = error.response?.data?.errors;
      const errorMessage = Array.isArray(apiErrors) ? apiErrors[0] : (error.response?.data?.error || error.message);
      
      res.status(500).json({ 
        success: false, 
        error: errorMessage || "Unknown error",
        details: "Bhai, OneSignal REST API Key ya App ID galat ho sakti hai. Please check karein."
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
