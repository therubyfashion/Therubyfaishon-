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
const oneSignalClient = new OneSignal.Client(
  process.env.ONESIGNAL_APP_ID || '',
  process.env.ONESIGNAL_REST_API_KEY || ''
);

// Initialize Firebase Admin for server-side operations
let db: any = null;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Initialize Admin SDK
    const adminApp = !admin.apps.length 
      ? admin.initializeApp({ 
          projectId: firebaseConfig.projectId 
        })
      : admin.app();

    console.log("Firebase Admin initialized with Project ID:", adminApp.options.projectId);

    // Use getFirestore from firebase-admin/firestore with the app instance
    if (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)') {
      db = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
    } else {
      db = getFirestore(adminApp);
    }
    console.log("Firebase Admin initialized on server");
  }
} catch (err) {
  console.error("Failed to initialize Firebase Admin on server:", err);
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
  app.post("/api/config", (req, res) => {
    const { resendApiKey, razorpayKeyId, razorpayKeySecret } = req.body;
    
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

      const response = await oneSignalClient.createNotification(notification);
      console.log("OneSignal notification sent:", response.body);
      res.json({ success: true, id: response.body.id });
    } catch (error: any) {
      console.error("OneSignal error:", error);
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

      const response = await oneSignalClient.createNotification(notification);
      res.json({ success: true, id: response.body.id });
    } catch (error: any) {
      console.error("OneSignal user notification error:", error);
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

      const response = await oneSignalClient.createNotification(notification);
      res.json({ success: true, id: response.body.id });
    } catch (error: any) {
      console.error("OneSignal admin notification error:", error);
      res.status(500).json({ error: error.message });
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
