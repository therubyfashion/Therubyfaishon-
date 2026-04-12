import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Resend } from 'resend';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import fs from 'fs';
import axios from 'axios';

dotenv.config();

// Initialize Firebase Admin for server-side operations
let db: any = null;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Initialize Admin SDK
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: firebaseConfig.projectId
      });
    }
    db = admin.firestore();
    if (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)') {
      db = admin.firestore(firebaseConfig.firestoreDatabaseId);
    }
    console.log("Firebase Admin initialized on server");
  }
} catch (err) {
  console.error("Failed to initialize Firebase Admin on server:", err);
}

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

  app.use(express.json());

  // Fast2SMS OTP Endpoints
  app.post("/api/send-otp", async (req, res) => {
    const { phoneNumber } = req.body;
    if (!phoneNumber || phoneNumber.length !== 10) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    // Get Fast2SMS API Key from env or Firestore
    let fast2smsKey = process.env.FAST2SMS_API_KEY;
    if (!fast2smsKey && db) {
      try {
        const settingsSnap = await db.collection('settings').get();
        if (!settingsSnap.empty) {
          fast2smsKey = settingsSnap.docs[0].data().fast2smsApiKey;
        }
      } catch (err) {
        console.error("Error fetching Fast2SMS key:", err);
      }
    }

    if (!fast2smsKey) {
      return res.status(500).json({ error: "Fast2SMS is not configured" });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    try {
      // Store OTP in Firestore
      if (db) {
        await db.collection('otp_codes').doc(phoneNumber).set({
          otp,
          expiry: expiry.toISOString(),
          createdAt: new Date().toISOString()
        });
      }

      // Send via Fast2SMS
      const response = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
        params: {
          authorization: fast2smsKey,
          route: 'otp',
          variables_values: otp,
          numbers: phoneNumber
        }
      });

      if (response.data.return) {
        res.json({ success: true, message: "OTP sent successfully" });
      } else {
        console.error("Fast2SMS Error:", response.data);
        res.status(500).json({ error: response.data.message || "Failed to send SMS" });
      }
    } catch (error: any) {
      console.error("OTP Send Error:", error);
      res.status(500).json({ error: error.message || "Failed to send OTP" });
    }
  });

  app.post("/api/verify-otp", async (req, res) => {
    const { phoneNumber, otp } = req.body;
    if (!phoneNumber || !otp) {
      return res.status(400).json({ error: "Phone number and OTP are required" });
    }

    try {
      if (!db) throw new Error("Database not initialized");

      const otpDoc = await db.collection('otp_codes').doc(phoneNumber).get();
      if (!otpDoc.exists) {
        return res.status(400).json({ error: "OTP not found or expired" });
      }

      const data = otpDoc.data();
      const now = new Date();
      const expiry = new Date(data.expiry);

      if (now > expiry) {
        await db.collection('otp_codes').doc(phoneNumber).delete();
        return res.status(400).json({ error: "OTP expired" });
      }

      if (data.otp !== otp) {
        return res.status(400).json({ error: "Invalid OTP" });
      }

      // Success! Delete OTP after verification
      await db.collection('otp_codes').doc(phoneNumber).delete();

      // Find or create user
      const querySnapshot = await db.collection('users').where("phoneNumber", "==", phoneNumber).get();
      
      let userData: any = null;
      if (!querySnapshot.empty) {
        userData = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
      } else {
        // Create new user if not exists
        const newUserId = `phone_${phoneNumber}`;
        const newUser = {
          uid: newUserId,
          phoneNumber: phoneNumber,
          role: 'user',
          isVerified: true,
          phoneVerified: true,
          createdAt: new Date().toISOString()
        };
        await db.collection('users').doc(newUserId).set(newUser);
        userData = newUser;
      }

      res.json({ 
        success: true, 
        user: userData,
        message: "Verified successfully" 
      });
    } catch (error: any) {
      console.error("OTP Verify Error:", error);
      res.status(500).json({ error: error.message || "Verification failed" });
    }
  });

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

  app.post("/api/send-email", async (req, res) => {
    const { to, subject, html, from } = req.body;
    
    if (!to || !subject || !html) {
      console.error("Missing required fields for email:", { to, subject, hasHtml: !!html });
      return res.status(400).json({ error: "Missing required fields: to, subject, or html" });
    }

    if (!currentResendApiKey) {
      console.warn("RESEND_API_KEY is missing. Email will not be sent.");
      return res.status(200).json({ message: "Email simulation: API key missing" });
    }

    try {
      const emailPayload = {
        from: from || 'The Ruby <onboarding@resend.dev>',
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: html,
      };

      const data = await resend.emails.send(emailPayload);
      
      if (data.error) {
        console.error("Resend API error details:", JSON.stringify(data.error, null, 2));
        return res.status(400).json({ 
          error: data.error.message || "Validation error", 
          name: data.error.name,
          details: data.error
        });
      }
      
      res.json(data);
    } catch (error: any) {
      console.error("Email execution error:", error);
      res.status(500).json({ error: error.message || "Failed to send email" });
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
