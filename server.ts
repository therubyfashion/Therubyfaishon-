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
import nodemailer from 'nodemailer';

dotenv.config();

// Central Configuration for Email Integrity
const VERIFIED_DOMAIN = "therubyfashion.shop";
const DEFAULT_FROM_EMAIL = `support@${VERIFIED_DOMAIN}`;

// Service instances
let razorpay: Razorpay | null = null;
let resend: Resend | null = null;
let currentResendApiKey = process.env.RESEND_API_KEY;
let oneSignalClient: any = null;

// Load persistent local config if available
const localConfigPath = path.join(process.cwd(), '.env.local.json');
if (fs.existsSync(localConfigPath)) {
  try {
    const localConfig = JSON.parse(fs.readFileSync(localConfigPath, 'utf8'));
    Object.entries(localConfig).forEach(([key, val]) => {
      if (val) process.env[key] = String(val);
    });
    console.log("✅ Local environment overrides loaded from .env.local.json");
  } catch (e) {
    console.error("❌ Failed to load .env.local.json");
  }
}

// Initialize clients from environment if available
const initClientsFromEnv = () => {
  if (process.env.RESEND_API_KEY) {
    currentResendApiKey = process.env.RESEND_API_KEY;
    resend = new Resend(currentResendApiKey);
    console.log("✅ Resend API initialized from environment");
  }

  if (process.env.VITE_RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
      key_id: process.env.VITE_RAZORPAY_KEY_ID.trim(),
      key_secret: process.env.RAZORPAY_KEY_SECRET.trim(),
    });
    console.log("✅ Razorpay initialized from environment");
  }

  if (process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY) {
    try {
      oneSignalClient = new OneSignal.Client(
        process.env.ONESIGNAL_APP_ID.trim(), 
        process.env.ONESIGNAL_REST_API_KEY.trim()
      );
      console.log("✅ OneSignal initialized from environment");
    } catch (e) {
      console.error("❌ OneSignal init failed:", e);
    }
  }
};

initClientsFromEnv();

// Initialize Firebase Admin for server-side operations
let db: any = null;
let adminApp: admin.app.App | null = null;
let currentFirestoreDatabaseId = '(default)';
let currentFirebaseProjectId = '';

const initializeFirebase = async (force = false) => {
  if (db && !force) return;
  try {
    const rootPath = process.cwd();
    const configPath = path.join(rootPath, 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) {
      console.log("ℹ️ Skipping Firebase Admin init: config file not found.");
      return;
    }

    let firestoreDatabaseId = '(default)';
    let firebaseProjectId = '';

    try {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      firestoreDatabaseId = firebaseConfig.firestoreDatabaseId || firestoreDatabaseId;
      firebaseProjectId = firebaseConfig.projectId || '';
    } catch (e) {
      console.error("❌ Failed to parse firebase-applet-config.json");
    }
    
    currentFirestoreDatabaseId = firestoreDatabaseId;
    currentFirebaseProjectId = firebaseProjectId;
      
    const targetProjectId = firebaseProjectId || process.env.PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
    if (!targetProjectId) {
      console.log("ℹ️ Skipping Firebase Admin init: No Project ID found in config or env.");
      return;
    }

    if (admin.apps.length > 0) {
      try {
        await Promise.all(admin.apps.map(a => a.delete().catch(() => {})));
      } catch (e) {}
    }
    
    try {
      console.log(`🚀 Starting Firebase Admin (Project: ${targetProjectId}, Database: ${firestoreDatabaseId})`);
      
      const adminOptions: any = {
        projectId: targetProjectId
      };

      try {
        adminOptions.credential = admin.credential.applicationDefault();
      } catch (e) {
        console.warn("ℹ️ Using implicit container credentials");
      }

      const app = admin.apps.length > 0 ? admin.app() : admin.initializeApp(adminOptions);
      adminApp = app;
      
      // Attempt connection to the configured database
      let currentDb = getFirestore(app, firestoreDatabaseId);
      
      try {
        // Initial Probe
        await currentDb.collection('settings').limit(1).get();
        db = currentDb;
        console.log("✅ Firebase Connected: Database is fully accessible.");
      } catch (probeErr: any) {
        const isPermissionError = probeErr.message.includes('PERMISSION_DENIED');
        const isNotFoundError = probeErr.message.includes('NOT_FOUND');

        if ((isPermissionError || isNotFoundError) && firestoreDatabaseId !== '(default)') {
          console.log(`ℹ️ Retrying with '(default)' database due to: ${probeErr.message}`);
          const fallbackDb = getFirestore(app, '(default)');
          try {
            await fallbackDb.collection('settings').limit(1).get();
            db = fallbackDb;
            currentFirestoreDatabaseId = '(default)';
            console.log("✅ Firebase Connected: Fallback to '(default)' database successful.");
          } catch (fallbackErr: any) {
            console.log("ℹ️ No databases accessible. Entering Hybrid Mode (Local Persistence Active).");
            db = null;
          }
        } else {
          console.log("ℹ️ Connectivity restricted. Entering Hybrid Mode (Local Persistence Active).");
          db = null;
        }
      }
    } catch (adminErr: any) {
      console.error("❌ Firebase Admin Initialization Failed:", adminErr.message);
      db = null;
    }
  } catch (err: any) {
    console.error("❌ Firebase Init silent fail:", err.message);
    db = null;
  }
};

// Start initialization in background to avoid blocking
setTimeout(() => {
  initializeFirebase().catch(() => {});
}, 2000);

// Helper to send OneSignal notifications via axios
async function sendOneSignalNotification(notification: any, config?: { appId?: string, restKey?: string }) {
  let appId = (config?.appId || '').trim();
  let restKey = (config?.restKey || '').trim();
  
  const isPlaceholder = (val: string) => !val || val === 'dummy-id' || val === 'YOUR_ONESIGNAL_APP_ID' || val === 'placeholder' || val.length < 10;

  // 1. If overrides not provided, try Firestore first (Dynamic settings)
  if (!appId || isPlaceholder(appId)) {
    if (db) {
      try {
        const settingsSnap = await db.collection('settings').limit(1).get();
        if (!settingsSnap.empty) {
          const settings = settingsSnap.docs[0].data();
          if (settings.oneSignalAppId && !isPlaceholder(settings.oneSignalAppId)) {
            appId = String(settings.oneSignalAppId).trim();
            restKey = String(settings.oneSignalRestApiKey || restKey || '').trim();
            console.log("OneSignal: Using configuration from Firestore 'settings' collection.");
          }
        }
      } catch (e: any) {
        console.error("OneSignal: Failed to fetch settings from DB:", e.message);
      }
    }
  }

  // 2. Fallback to Environment Variables (Static settings)
  if (!appId || isPlaceholder(appId)) {
    appId = (process.env.ONESIGNAL_APP_ID || process.env.VITE_ONESIGNAL_APP_ID || '').trim();
    restKey = (restKey || process.env.ONESIGNAL_REST_API_KEY || '').trim();
    if (appId && !isPlaceholder(appId)) {
      console.log("OneSignal: Using configuration from Environment Variables (Secrets).");
    }
  }

  if (isPlaceholder(appId) || (restKey && isPlaceholder(restKey))) {
    throw new Error("OneSignal is not configured properly.");
  }

  // Clean the key (remove 'Basic ' if user accidentally copied it)
  const cleanRestKey = restKey ? restKey.replace(/Basic\s+/i, '').trim() : '';

  const headers: any = { 'Content-Type': 'application/json' };
  if (cleanRestKey) {
    headers['Authorization'] = `Basic ${cleanRestKey}`;
  }

  return await axios.post('https://onesignal.com/api/v1/notifications', 
    { ...notification, app_id: appId },
    { headers }
  );
}

// Cache for store settings to avoid frequent Firestore calls
let cachedSettings: any = null;
let lastSettingsFetch = 0;
const SETTINGS_CACHE_TTL = 5000; // 5 seconds for faster admin updates

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global Unhandled Error Catchers
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('🔥 Uncaught Exception:', err);
});

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  
  console.log(`🚀 Starting server...`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 Port: ${PORT}`);

  // Initialize clients inside startServer for robustness
  resend = new Resend(currentResendApiKey);
  const initialKeyId = (process.env.VITE_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_ID)?.trim();
  const initialKeySecret = (process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET_KEY || process.env.RAZORPAY_SECRET)?.trim();

  if (initialKeyId && initialKeySecret) {
    try {
      razorpay = new Razorpay({
        key_id: initialKeyId,
        key_secret: initialKeySecret,
      });
      console.log("✅ Razorpay initialized successfully");
    } catch (err: any) {
      console.error("❌ Razorpay initialization failed:", err.message);
    }
  }

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Root route for Health Checks & Production Serving
  app.get("/", (req, res, next) => {
    if (process.env.NODE_ENV === "production") {
      const distPath = path.join(process.cwd(), 'dist');
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      } else {
        // Return 200 OK for Render Health Check even if dist is missing
        return res.status(200).send("Server is UP, but 'dist' folder is missing. Bhai, please run 'npm run build'.");
      }
    }
    next();
  });

  app.get("/api/health", (req, res) => {
    res.status(200).send("OK ✅");
  });

  app.post("/api/track-order", async (req, res) => {
    const { orderId, email } = req.body;
    
    if (!orderId || !email) {
      return res.status(400).json({ error: "Bhai, Order ID aur Email dono zaroori hain." });
    }

    try {
      if (!db) await initializeFirebase();
      if (!db) {
        return res.status(503).json({ error: "Database abhi ready ho raha hai. 2-3 minute baad dobara try karein! 💎" });
      }
      
      let orderData: any = null;
      const oid = String(orderId).trim();
      const targetEmail = String(email).trim().toLowerCase();

      // 1. Try finding by document ID first
      if (oid.length > 15) {
        const docSnap = await db.collection('orders').doc(oid).get();
        if (docSnap.exists) {
          orderData = { id: docSnap.id, ...docSnap.data() };
        }
      }

      // 2. Try finding by custom orderId field
      if (!orderData) {
        const querySnap = await db.collection('orders')
          .where('orderId', '==', oid.toUpperCase())
          .limit(1)
          .get();
        
        if (!querySnap.empty) {
          const doc = querySnap.docs[0];
          orderData = { id: doc.id, ...doc.data() };
        }
      }

      if (!orderData) {
        return res.status(404).json({ error: "Order nahi mila. Please Order ID check karein." });
      }

      // 3. Verify Email match
      const customerEmail = (orderData.email || orderData.address?.email || orderData.customerEmail || '').toLowerCase();
      
      if (customerEmail !== targetEmail) {
        return res.status(403).json({ error: "Email address is Order ID se match nahi kar raha hai." });
      }

      // Return order (sanitized - remove sensitive internal data if any, but usually orders are fine)
      res.json(orderData);
    } catch (error: any) {
      console.error("Order tracking error:", error);
      const isPermissionError = error.message?.includes("PERMISSION_DENIED") || error.code === 7;
      const isNotFoundError = error.message?.includes("NOT_FOUND") || error.code === 5;
      
      // If NOT_FOUND, maybe the database ID is wrong or not provisioned yet.
      // We can try to re-initialize once if we haven't already
      if (isNotFoundError && (req as any)._retryCount !== 1) {
        console.log("NOT_FOUND detected. Re-initializing Firebase and retrying...");
        (req as any)._retryCount = 1;
        await initializeFirebase(true);
        // Recursively call the same logic once
        return res.redirect(307, req.originalUrl); 
      }

      let userFriendlyError = "Tracking failed on server. Please try again later.";
      if (isPermissionError) {
        userFriendlyError = `Bhai, Firebase Permission Error!
        \nProject: ${adminApp?.options.projectId || 'unknown'}
        \nDatabase: ${currentFirestoreDatabaseId}
        \nSamadhan: Ek baar Admin Panel mein 'Set up Firebase' button par click karein aur terms accept karein. Isse permissions reset ho jayengi.`;
      } else if (isNotFoundError) {
        userFriendlyError = `Bhai, Database NOT_FOUND Error!
        \nDatabase ID: ${currentFirestoreDatabaseId}
        \nYe tab hota hai jab Firebase database abhi tak puri tarah "Active" nahi hua hai ya region galat hai. 
        \nSamadhan: 2-3 minute wait karein, ya Dashboard se 'Set up Firebase' dobara karein.`;
      }

      res.status(500).json({ 
        error: userFriendlyError,
        diagnostics: {
          projectId: adminApp?.options.projectId,
          databaseId: currentFirestoreDatabaseId,
          errorCode: error.code,
          errorMessage: error.message
        }
      });
    }
  });

  app.get("/api/firebase-status", async (req, res) => {
    try {
      const forceRefresh = req.query.force === 'true';
      if (forceRefresh) {
        await initializeFirebase(true);
      }
      
      const info = { 
        databaseId: currentFirestoreDatabaseId, 
        projectId: adminApp?.options.projectId,
        usingLocalPersistence: fs.existsSync(localConfigPath)
      };

      if (!db) {
        return res.json({ 
          success: false, 
          status: "Hybrid Mode (Safe) 🔐", 
          error: "Database restricted or not found. Using local settings for Email/OTP.",
          info
        });
      }
      
      const collections = await db.listCollections();
      res.json({ 
        success: true, 
        status: "Connected ✅",
        collectionsFound: Array.isArray(collections) ? collections.length : 0,
        info
      });
    } catch (error: any) {
      const isPermission = error.message?.includes('PERMISSION_DENIED');
      res.json({ 
        success: false, 
        status: "Hybrid Mode (Safe) 🔐", 
        error: isPermission ? "Database permissions pending. Email system is active." : "Database initialization in progress...",
        info: { databaseId: currentFirestoreDatabaseId, projectId: adminApp?.options.projectId }
      });
    }
  });

  app.post("/api/config", (req, res) => {
    const { 
      resendApiKey, 
      razorpayKeyId, 
      razorpayKeySecret, 
      oneSignalAppId, 
      oneSignalRestApiKey,
      smtpUser,
      smtpPass 
    } = req.body;
    
    // Force cache refresh on next request
    cachedSettings = null;
    lastSettingsFetch = 0;

    if (resendApiKey) {
      currentResendApiKey = resendApiKey;
      resend = new Resend(currentResendApiKey);
      process.env.RESEND_API_KEY = resendApiKey;
      console.log("Resend API Key updated");
    }

    if (smtpUser) process.env.SMTP_USER = smtpUser;
    if (smtpPass) process.env.SMTP_PASS = smtpPass;

    if (razorpayKeyId && razorpayKeySecret) {
      razorpay = new Razorpay({
        key_id: razorpayKeyId.trim(),
        key_secret: razorpayKeySecret.trim(),
      });
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

    // Persist settings locally as a fallback for restarts
    try {
      const configBackup = {
        RESEND_API_KEY: process.env.RESEND_API_KEY,
        SMTP_USER: process.env.SMTP_USER,
        SMTP_PASS: process.env.SMTP_PASS,
        VITE_RAZORPAY_KEY_ID: process.env.VITE_RAZORPAY_KEY_ID,
        RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
        ONESIGNAL_APP_ID: process.env.ONESIGNAL_APP_ID,
        ONESIGNAL_REST_API_KEY: process.env.ONESIGNAL_REST_API_KEY
      };
      fs.writeFileSync(localConfigPath, JSON.stringify(configBackup, null, 2));
    } catch (e) {}

    res.json({ status: "ok", message: "Configs persisted locally" });
  });

  app.get("/api/system-health", (req, res) => {
    const healthReport = {
      timestamp: new Date().toISOString(),
      status: "Operational",
      services: {
        firebase: {
          status: db ? "Connected ✅" : "Hybrid Mode (Local) 🔐",
          projectId: adminApp?.options.projectId || 'Not Configured',
          databaseId: currentFirestoreDatabaseId
        },
        email: {
          status: (process.env.SMTP_USER || process.env.RESEND_API_KEY) ? "Configured ✅" : "Not Configured ❌",
          activeProvider: process.env.SMTP_USER ? "Gmail SMTP" : (process.env.RESEND_API_KEY ? "Resend API" : "None"),
          hasResendKey: !!process.env.RESEND_API_KEY,
          hasSmtpUser: !!process.env.SMTP_USER,
          usingLocalPersistence: fs.existsSync(localConfigPath),
          verifiedDomain: VERIFIED_DOMAIN,
          defaultFrom: DEFAULT_FROM_EMAIL
        },
        razorpay: {
          status: process.env.VITE_RAZORPAY_KEY_ID ? "Configured ✅" : "Missing Keys ❌",
          keyId: process.env.VITE_RAZORPAY_KEY_ID ? `${process.env.VITE_RAZORPAY_KEY_ID.substring(0, 8)}...` : 'None'
        },
        oneSignal: {
          status: oneSignalClient ? "Initialized ✅" : "Pending ⏳",
          appId: process.env.VITE_ONESIGNAL_APP_ID ? `${process.env.VITE_ONESIGNAL_APP_ID.substring(0, 8)}...` : 'None'
        }
      }
    };
    res.json(healthReport);
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
    const { to, subject, html, from, fromName: providedFromName, replyTo } = req.body;
    
    try {
      // 1. Fetch Latest Settings (Caching handles performance)
      const now = Date.now();
      if (!cachedSettings || (now - lastSettingsFetch > SETTINGS_CACHE_TTL)) {
        try {
          if (db) {
            const settingsSnap = await db.collection('settings').limit(1).get();
            if (!settingsSnap.empty) {
              cachedSettings = settingsSnap.docs[0].data();
              lastSettingsFetch = now;
            } else {
              // Mark as fetched even if empty to avoid constant retries on empty DB
              lastSettingsFetch = now;
            }
          }
        } catch (dbErr: any) {
          console.error("Firestore settings fetch failed:", dbErr.message);
          // If we hit a permission error or similar, don't spam.
          // Set a long cooldown (2 minutes) before trying firestore again.
          lastSettingsFetch = now - (SETTINGS_CACHE_TTL - 120000); 
        }
      }

      // Default settings fallback
      const effectiveSettings = cachedSettings || {
        storeName: 'The Ruby',
        fromEmail: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL,
        resendApiKey: process.env.RESEND_API_KEY,
        smtpUser: process.env.SMTP_USER,
        smtpPass: process.env.SMTP_PASS
      };

      // 2. Resolve From name and email
      const smtpUser = effectiveSettings.smtpUser || process.env.SMTP_USER;
      const smtpPass = effectiveSettings.smtpPass || process.env.SMTP_PASS;
      const apiKey = effectiveSettings.resendApiKey || process.env.RESEND_API_KEY || currentResendApiKey;

      let fromName = providedFromName || effectiveSettings.storeName || 'The Ruby';
      
      // Determine base from email - EXPLICITLY REJECT rubyfashion.shop (missing 'the')
      let rawFromEmail = from || effectiveSettings.fromEmail || DEFAULT_FROM_EMAIL;
      
      if (rawFromEmail.includes('rubyfashion.shop') && !rawFromEmail.includes(VERIFIED_DOMAIN)) {
        console.warn(`🛑 DETECTED TYPO DOMAIN: ${rawFromEmail}. Correcting to ${DEFAULT_FROM_EMAIL}`);
        rawFromEmail = DEFAULT_FROM_EMAIL;
      }

      // Mandatory Domain Protection for Resend
      if (!smtpUser && rawFromEmail.includes('resend.dev')) {
        console.warn("Blocking unverified 'resend.dev' domain for Resend. Defaulting to verified store domain.");
        rawFromEmail = DEFAULT_FROM_EMAIL;
      }

      // If using SMTP, ensure the 'from' matches the authenticated user to avoid rejection
      const finalFromEmail = (smtpUser && smtpUser.includes('@gmail.com')) ? smtpUser : rawFromEmail;
      
      const formattedFrom = `"${fromName}" <${finalFromEmail}>`;

      console.log(`📧 Routing Email: To=${to}, From=${formattedFrom}, Subject=${subject}`);
      console.log(`Email Service Selection: ${smtpUser ? 'Gmail SMTP' : (apiKey ? 'Resend API' : 'NONE')}`);
      console.log(`DEBUG: Target Verified Domain is ${VERIFIED_DOMAIN}`);

      if (smtpUser && smtpPass) {
        console.log("📨 Normal Gmail SMTP mode: Sending OTP...");
        
        const cleanUser = String(smtpUser).trim();
        const cleanPass = String(smtpPass).replace(/\s/g, ''); 
        
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: cleanUser,
            pass: cleanPass
          }
        });

        try {
          const result = await transporter.sendMail({
            from: `"${fromName}" <${cleanUser}>`,
            to: Array.isArray(to) ? to.join(', ') : to,
            subject: subject,
            html: html,
            replyTo: replyTo || cleanUser
          });

          console.log("✅ GMAIL SENT:", result.messageId);
          return res.json({ id: result.messageId, provider: 'smtp' });
        } catch (smtpErr: any) {
          console.error("❌ GMAIL ERROR:", smtpErr.message);
          
          let hint = "Bhai, Gmail login fail ho gaya. ";
          if (smtpErr.message.includes('Invalid login') || smtpErr.message.includes('Username and Password not accepted')) {
            hint += "Pakka aapka 'App Password' galat hai. Google Account mein naya 16-letter code banayein.";
          } else {
            hint += smtpErr.message;
          }

          // Force stop here if SMTP was intended. No fallback to Resend to avoid confusing 403 errors.
          return res.status(500).json({ 
            error: "Gmail Delivery Failed", 
            message: smtpErr.message,
            hint: hint 
          });
        }
      }

      // 4. Default to Resend API if SMTP not configured
      if (!apiKey) {
        console.error("Email configuration missing (No SMTP and no API Key).");
        return res.status(400).json({ 
          error: "Bhai, Email set karne ke do raste hain:\n1. Admin -> Settings mein Gmail User aur App Password daalein (Aasan).\n2. Ya phir Resend API Key set karein (Professional)." 
        });
      }

      const dynamicResend = new Resend(apiKey);
      
      const emailPayload: any = {
        from: formattedFrom,
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: html,
      };

      if (replyTo) {
        emailPayload.reply_to = replyTo;
      }

      console.log("--- Resend API Attempt ---");
      const { data, error } = await dynamicResend.emails.send(emailPayload);
      
      if (error) {
        console.error("Resend API Error Detail:", JSON.stringify(error, null, 2));
        let errorMessage = (error as any).message || "Resend failed to send email";
        const errLower = errorMessage.toLowerCase();
        
        // Detailed 403 Handling (Sandbox Restrictions)
        if (errLower.includes("not verified") || 
            errLower.includes("onboarding") || 
            errLower.includes("authorized") || 
            errLower.includes("testing emails") ||
            errLower.includes("403") ||
            errLower.includes("restricted")) {
          
          errorMessage = `Bhai, Resend 403 (Domain Error)!
          \nResend keh raha hai: "${errorMessage}"
          \nSamadhan:
          1. Aapka verified domain "${VERIFIED_DOMAIN}" hai.
          2. Aapne shayad "rubyfashion.shop" (missing 'the') use kiya hai jo Verified NAHI hai.
          3. Admin Panel -> Settings mein jaa kar "From Email" ko "${DEFAULT_FROM_EMAIL}" set karein.
          4. Jab tak domain verify nahi hota, Resend kisi aur ko email nahi bhejta.`;
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
    const { title, body, url, type, appId, restKey } = req.body;
    
    try {
      console.log("OneSignal: Sending broadcast notification...");
      
      const notification = {
        contents: {
          en: body || "New update from the store!",
        },
        headings: {
          en: title || "Store Update",
        },
        url: url || '/',
        included_segments: type === 'all' ? ['Subscribed Users'] : (type === 'active' ? ['Active Users'] : ['Subscribed Users']),
      };

      const response = await sendOneSignalNotification(notification, { appId, restKey });
      console.log("OneSignal notification sent:", response.data);
      res.json({ success: true, id: response.data.id });
    } catch (error: any) {
      const errorData = error.response?.data;
      const errorMsg = errorData?.errors ? (Array.isArray(errorData.errors) ? errorData.errors.join(', ') : JSON.stringify(errorData.errors)) : error.message;

      console.error("OneSignal Broadcast Error Detail:", JSON.stringify(errorData || error.message, null, 2));

      // Friendly mapping of common OneSignal errors
      let userFriendlyError = "Broadcast notification fail ho gaya. 🔔";
      let hint = "";

      if (errorMsg.includes("not subscribed") || errorMsg.includes("no users") || errorMsg.includes("All Subscribed Users")) {
        console.warn("OneSignal Broadcast Warning: No subscribed users yet.");
        return res.json({ 
          success: true, 
          warning: "Bhai, abhi tak kisi ne Push Notifications ON nahi kiya hai (No one subscribed yet). Isliye msg kisi ko nahi gaya. Pehle mobile par app khol kar 'Allow' kijiye.", 
          id: null 
        });
      }

      const errLower = errorMsg.toLowerCase();
      if (errLower.includes("app_id not found") || errLower.includes("invalid app_id") || errLower.includes("app_id")) {
        hint = "❌ ERROR: OneSignal App ID galat hai! \nSamadhan: Admin Panel -> Settings mein check karein ki 'OneSignal App ID' bilkul sahi hai.";
      } else if (errLower.includes("rest api key") || errLower.includes("invalid rest api key") || errLower.includes("unauthorized")) {
        hint = "❌ ERROR: REST API Key galat hai! \nSamadhan: OneSignal Settings -> Keys & IDs mein jaein, aur wo LAMBI waali key (REST API Key) copy karke Admin panel me dalein.";
      } else if (errLower.includes("segment") || errLower.includes("filters")) {
        hint = "❌ ERROR: OneSignal Segment Error! \nSamadhan: OneSignal Dashboard par check karein ki 'Subscribed Users' naam ka segment exist karta hai.";
      }

      res.status(500).json({ 
        error: userFriendlyError,
        details: errorData || error.message,
        hint: hint || `OneSignal Error Detail: ${errorMsg}`
      });
    }
  });

  // Send notification to specific user (for order updates)
  app.post("/api/send-user-push", async (req, res) => {
    const { userId, title, body, url } = req.body;
    
    try {
      console.log(`OneSignal: Sending notification to user ${userId}...`);
      
      if (!userId) {
        return res.status(400).json({ error: "OneSignal error: userId is required for targeted push." });
      }

      const notification = {
        contents: {
          en: body || "Your order status has been updated.",
        },
        headings: {
          en: title || "Order Update",
        },
        url: url || '/',
        include_external_user_ids: [String(userId)],
      };

      const response = await sendOneSignalNotification(notification);
      res.json({ success: true, id: response.data.id });
    } catch (error: any) {
      const errorData = error.response?.data;
      const errorMsg = errorData?.errors ? (Array.isArray(errorData.errors) ? errorData.errors.join(', ') : JSON.stringify(errorData.errors)) : error.message;

      // Specific user error: usually means user hasn't accepted push permissions yet or synced yet
      if (errorMsg.includes("not subscribed") || errorMsg.includes("not found")) {
        console.warn(`OneSignal Targeted Push Warning for ${userId}:`, errorMsg);
        return res.json({ success: true, warning: "User not yet subscribed to push notifications.", id: null });
      }

      console.error("OneSignal User Push Error Detail:", JSON.stringify(errorData || error.message, null, 2));
      let userFriendlyError = "Push notification fail ho gaya.";
      if (errorData?.errors) {
        userFriendlyError = `OneSignal Error: ${errorMsg}`;
      }

      res.status(500).json({ 
        error: userFriendlyError,
        details: errorData || error.message
      });
    }
  });

  // Send notification to admins (for new orders)
  app.post("/api/send-admin-push", async (req, res) => {
    const { title, body, url } = req.body;
    
    try {
      console.log("OneSignal: Sending notification to admins...");
      
      const notification = {
        contents: {
          en: body || "New order received!",
        },
        headings: {
          en: title || "New Order",
        },
        url: url || '/',
        filters: [
          { field: "tag", key: "role", relation: "=", value: "admin" }
        ],
      };

      const response = await sendOneSignalNotification(notification);
      res.json({ success: true, id: response.data.id });
    } catch (error: any) {
      const errorData = error.response?.data;
      console.error("OneSignal Admin Push Error Detail:", JSON.stringify(errorData || error.message, null, 2));
      
      let userFriendlyError = "Admin notification fail ho gaya.";
      if (errorData?.errors) {
        userFriendlyError = `OneSignal Error: ${errorData.errors.join(', ')}`;
      }

      res.status(500).json({ 
        error: userFriendlyError,
        details: errorData || error.message
      });
    }
  });

  app.post("/api/test-onesignal", async (req, res) => {
    try {
      const { appId, restKey } = req.body;
      
      if (!appId || !restKey) {
        return res.status(400).json({ 
          success: false, 
          error: "OneSignal App ID or REST API Key is missing.",
          hint: "Bhai, App ID aur REST API Key enter karein, phir test karein."
        });
      }

      console.log(`Testing OneSignal with App ID: ${appId}`);

      // Use unified function but with a dummy notification to check keys
      // Actually players endpoint is better for just testing keys
      const cleanRestKey = restKey.replace(/Basic\s+/i, '').trim();
      const response = await axios.get(`https://onesignal.com/api/v1/players?app_id=${appId}&limit=1`, {
        headers: {
          'Authorization': `Basic ${cleanRestKey}`,
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
      const errorDetail = Array.isArray(apiErrors) ? apiErrors[0] : (error.response?.data?.error || error.message);
      
      res.status(500).json({ 
        success: false, 
        error: errorDetail || "Unknown error",
        hint: "Bhai, ye key galat hai. OneSignal Dashboard -> Settings -> Keys & IDs mein jaein, aur 'REST API Key' copy karein. 'Key ID' mat copy karna!"
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
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      app.get('*', (req, res) => {
        res.status(404).send("Bhai, 'dist' folder nahi mila. App build nahi hui hai. AI Studio mein 'compile_applet' run karein.");
      });
    }
  }

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("🔥 Global Server Error:", err);
    res.status(500).json({ 
      error: "Bhai, server mein kuch problem ayi hai.",
      message: err.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("🔥 CRITICAL: Server failed to start:", err);
});
