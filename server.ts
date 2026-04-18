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
let adminApp: admin.app.App | null = null;

const initializeFirebase = async () => {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    let firestoreDatabaseId = '(default)';
    let firebaseProjectId = undefined;

    if (fs.existsSync(configPath)) {
      try {
        const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        firestoreDatabaseId = firebaseConfig.firestoreDatabaseId || firestoreDatabaseId;
        firebaseProjectId = firebaseConfig.projectId;
      } catch (e) {
        console.warn("Could not parse firebase-applet-config.json:", e);
      }
    }
      
    // 1. Initialize Admin App
    try {
      if (admin.apps.length > 0) {
        adminApp = admin.app();
      } else {
        // CRITICAL: We MUST use the projectId from firebase-applet-config.json
        // because the environment project (ais-...) usually doesn't have Firestore enabled.
        const targetProjectId = firebaseProjectId || process.env.PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
        
        console.log(`Initializing Firebase Admin for Project: ${targetProjectId}`);
        
        adminApp = admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: targetProjectId
        });
      }
    } catch (initErr: any) {
      console.warn("Project-specific init failed, trying basic ADC:", initErr.message);
      adminApp = admin.initializeApp({ 
        credential: admin.credential.applicationDefault()
      });
    }

    if (!adminApp) throw new Error("Failed to initialize adminApp");
    
    // 2. Resolve Firestore (Brute Force Strategy)
    const tryConnect = async (dbId: string): Promise<any> => {
      console.log(`Testing Firestore Database: [${dbId}]`);
      const testDb = dbId === '(default)' ? getFirestore(adminApp!) : getFirestore(adminApp!, dbId);
      // Wait for a small health check
      await testDb.listCollections();
      return testDb;
    };

    // Primary Attempt: Try config database
    try {
      if (firestoreDatabaseId && firestoreDatabaseId !== '(default)') {
        db = await tryConnect(firestoreDatabaseId);
        console.log(`✅ Connected to config database: ${firestoreDatabaseId}`);
      } else {
        throw new Error("No specific database in config");
      }
    } catch (primaryErr: any) {
      console.warn(`❌ Specific database [${firestoreDatabaseId}] failed: ${primaryErr.message}`);
      
      // Secondary Attempt: Try (default)
      try {
        console.log("🔄 Fallback: Trying '(default)' database...");
        db = await tryConnect('(default)');
        console.log("✅ Connected to '(default)' database.");
      } catch (fallback1Err: any) {
        console.error(`❌ Fallback '(default)' failed: ${fallback1Err.message}`);

        // Tertiary Attempt: If nothing works, just assign default and let it fail on query 
        // with more descriptive errors later
        db = getFirestore(adminApp!);
        console.log("⚠️ Using default Firestore instance without verification.");
      }
    }
  } catch (err) {
    console.error("FATAL: Firebase bootstrap failed:", err);
  }
};

// Start initialization immediately
initializeFirebase();

// Helper to send OneSignal notifications via axios
async function sendOneSignalNotification(notification: any) {
  let appId = (process.env.ONESIGNAL_APP_ID || process.env.VITE_ONESIGNAL_APP_ID || '').trim();
  let restKey = (process.env.ONESIGNAL_REST_API_KEY || '').trim();

  const isPlaceholder = (val: string) => !val || val === 'dummy-id' || val === 'YOUR_ONESIGNAL_APP_ID' || val === 'placeholder' || val.length < 10;

  // If not in env or seems to be a placeholder, try to fetch from Firestore
  if (isPlaceholder(appId) || isPlaceholder(restKey)) {
    if (db) {
      try {
        console.log("OneSignal configuration missing or invalid in env, attempting to fetch from Firestore 'settings'...");
        const settingsSnap = await db.collection('settings').limit(1).get();
        if (!settingsSnap.empty) {
          const settings = settingsSnap.docs[0].data();
          if (settings.oneSignalAppId && settings.oneSignalRestApiKey) {
            appId = String(settings.oneSignalAppId).trim();
            restKey = String(settings.oneSignalRestApiKey).trim();
            console.log("OneSignal config successfully loaded from Firestore.");
          }
        }
      } catch (e: any) {
        console.error("Failed to fetch OneSignal settings from DB:", e.message);
      }
    }
  }

  if (isPlaceholder(appId) || isPlaceholder(restKey)) {
    throw new Error("OneSignal is not configured. Bhai, Admin Panel -> Settings mein 'OneSignal App ID' aur 'REST API Key' sahi se enter karein.");
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
      if (!db) {
        console.log("Database object is null, attempting late initialization...");
        await initializeFirebase();
      }

      if (!db) throw new Error("Firebase Admin not initialized on server (db is null)");
      
      // Try a simple operation to check permissions
      let collections;
      try {
        collections = await db.listCollections();
      } catch (e: any) {
        console.warn(`API Check Failed: ${e.message}`);
        // If not found, it might be because the global DB object is stale or wrong DB ID
        if (e.message.includes("NOT_FOUND") || e.message.includes("5")) {
          console.log("Stale DB or NOT_FOUND detected in API. Re-triggering bootstrap...");
          await initializeFirebase();
          collections = await db.listCollections();
        } else {
          throw e;
        }
      }
      
      res.json({ 
        success: true, 
        status: "Connected ✅",
        collectionsFound: collections.length,
        info: {
          databaseId: db._databaseId || db.databaseId || 'default',
          projectId: adminApp?.options.projectId || 'unknown',
          envProjectId: process.env.PROJECT_ID || 'missing'
        }
      });
    } catch (error: any) {
      console.error("Firebase Status Check Failed:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        code: error.code,
        diagnostics: {
          projectId: adminApp?.options.projectId,
          envProjectId: process.env.PROJECT_ID,
          hasDbObject: !!db
        },
        details: "Bhai, ye 'NOT_FOUND' error ka matlab hai ki database exist nahi karta. Maine 3 alag-alag tarike se connect karne ki koshish ki hai. Agar ab bhi nahi ho raha, toh please ek baar settings mein 'Set up Firebase' button click karein, aur region 'asia-southeast1' choose karein."
      });
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
    const { to, subject, html, from, fromName: providedFromName, replyTo } = req.body;
    
    try {
      // 1. Fetch Latest Settings (Caching handles performance)
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

      // 2. Resolve API Key
      const apiKey = process.env.RESEND_API_KEY || currentResendApiKey || cachedSettings?.resendApiKey;
      
      if (!apiKey) {
        console.error("Email API Key not found in Environment or Database.");
        return res.status(400).json({ error: "Bhai, Admin Panel mein 'Resend API Key' set karein." });
      }

      const dynamicResend = new Resend(apiKey);
      
      // 3. Resolve From name and email
      let fromName = providedFromName || cachedSettings?.storeName || 'The Ruby';
      const fromEmail = from || cachedSettings?.fromEmail || process.env.RESEND_FROM_EMAIL || `onboarding@resend.dev`;
      
      // Format correctly: "Name" <email@domain.com>
      const formattedFrom = fromEmail.includes('<') ? fromEmail : `"${fromName}" <${fromEmail}>`;

      const emailPayload: any = {
        from: formattedFrom,
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: html,
      };

      if (replyTo) {
        emailPayload.reply_to = replyTo;
      }

      console.log("--- Email Sending Attempt ---");
      console.log("To:", JSON.stringify(to));
      console.log("From:", formattedFrom);
      
      if (!to || (Array.isArray(to) && to.length === 0) || to === '') {
        return res.status(400).json({ error: "Recipient email is missing." });
      }

      const { data, error } = await dynamicResend.emails.send(emailPayload);
      
      if (error) {
        console.error("Resend API Error:", JSON.stringify(error, null, 2));
        let errorMessage = (error as any).message || "Resend failed to send email";
        
        if (errorMessage.toLowerCase().includes("not verified") || errorMessage.toLowerCase().includes("onboarding") || errorMessage.toLowerCase().includes("authorized")) {
          errorMessage = `Bhai, Resend Domain Error: "${errorMessage}".
          \nSamadhan:
          1. Agar domain verify kiya hai, toh Admin Settings mein "From Email" ko apna verified email daliye.
          2. Agar domain verify NAHI hai, toh aap sirf apne signup email par hi test kar sakte hain. Customer ko email nahi jayega jab tak domain verify na ho.`;
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
          en: body || "New update from the store!",
        },
        headings: {
          en: title || "Store Update",
        },
        url: url || '/',
        included_segments: type === 'all' ? ['Subscribed Users'] : (type === 'active' ? ['Active Users'] : ['Subscribed Users']),
      };

      const response = await sendOneSignalNotification(notification);
      console.log("OneSignal notification sent:", response.data);
      res.json({ success: true, id: response.data.id });
    } catch (error: any) {
      const errorData = error.response?.data;
      const errorMsg = errorData?.errors ? (Array.isArray(errorData.errors) ? errorData.errors.join(', ') : JSON.stringify(errorData.errors)) : error.message;

      // Don't treat "not subscribed" as a hard crash
      if (errorMsg.includes("not subscribed")) {
        console.warn("OneSignal Broadcast Warning:", errorMsg);
        return res.json({ success: true, warning: errorMsg, id: null });
      }

      console.error("OneSignal Broadcast Error Detail:", JSON.stringify(errorData || error.message, null, 2));
      let userFriendlyError = "Broadcast notification fail ho gaya.";
      if (errorData?.errors) {
        userFriendlyError = `OneSignal Error: ${errorMsg}`;
      }

      res.status(500).json({ 
        error: userFriendlyError,
        details: errorData || error.message
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
