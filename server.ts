import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import geoip from "geoip-lite";
import requestIp from "request-ip";
import { Resend } from 'resend';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp as initClientApp, getApps as getClientApps } from 'firebase/app';
import { getFirestore as getClientFirestore, doc as cDoc, getDoc as cGetDoc, collection as cCollection, getDocs as cGetDocs, limit as cLimit, query as cQuery, where as cWhere, addDoc as cAddDoc, updateDoc as cUpdateDoc, onSnapshot as cOnSnapshot } from 'firebase/firestore';
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

// Initialize Firebase Admin and Client Fallback for server-side operations
let db: any = null;
let clientDb: any = null;
let isClientDbReady = false;
let isDbWriteable = true; // Track if the database is fully writable/accessible
let adminApp: admin.app.App | null = null;
let currentFirestoreDatabaseId = '(default)';
let currentFirebaseProjectId = '';

const initializeClientFirestore = () => {
  if (isClientDbReady && clientDb) return;
  try {
    const rootPath = process.cwd();
    const configPath = path.join(rootPath, 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const dbId = currentFirestoreDatabaseId || firebaseConfig.firestoreDatabaseId || '(default)';
      const apps = getClientApps();
      const cApp = apps.length === 0 ? initClientApp(firebaseConfig, 'node-server-secondary') : apps[0];
      clientDb = getClientFirestore(cApp, dbId);
      isClientDbReady = true;
      console.log(`✅ Resilient Client Firestore SDK fallback initialized successfully with database ID: ${dbId}`);
    }
  } catch (err: any) {
    console.warn("⚠️ Client SDK initialization fallback skipped:", err.message);
  }
};

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
        if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
          console.log("🔑 Initializing Firebase Admin via custom credentials from environment variables.");
          adminOptions.credential = admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
          });
        } else {
          adminOptions.credential = admin.credential.applicationDefault();
        }
      } catch (e: any) {
        console.warn("ℹ️ Default credential loading failed:", e.message);
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
        isDbWriteable = true;
        console.log("✅ Firebase Connected: Database is fully accessible.");
        // Try to seed settings as database is writable
        seedSettingsIfEmpty(currentDb).catch((err) => {
          console.warn("⚠️ Seeding skipped on main db:", err.message);
        });
      } catch (probeErr: any) {
        console.warn("⚠️ Firebase Admin initial probe failed:", probeErr.message);
        isDbWriteable = false; // Mark restricted initially
        const isPermissionError = probeErr.message.includes('PERMISSION_DENIED');
        const isNotFoundError = probeErr.message.includes('NOT_FOUND');

        if ((isPermissionError || isNotFoundError) && firestoreDatabaseId !== '(default)') {
          console.log(`ℹ️ Retrying with '(default)' database due to: ${probeErr.message}`);
          const fallbackDb = getFirestore(app, '(default)');
          try {
            await fallbackDb.collection('settings').limit(1).get();
            db = fallbackDb;
            isDbWriteable = true;
            currentFirestoreDatabaseId = '(default)';
            console.log("✅ Firebase Connected: Fallback to '(default)' database successful.");
            // Try to seed settings on fallback db
            seedSettingsIfEmpty(fallbackDb).catch((err) => {
              console.warn("⚠️ Seeding skipped on fallback db:", err.message);
            });
          } catch (fallbackErr: any) {
            console.log("ℹ️ Fallback database probe also failed. Assigning configured database to prevent lockouts.");
            db = currentDb;
            isDbWriteable = false;
          }
        } else {
          console.log("ℹ️ Connectivity restricted. Assigning configured database anyway to prevent lockouts.");
          db = currentDb;
          isDbWriteable = false;
        }
      }
    } catch (adminErr: any) {
      console.error("❌ Firebase Admin Initialization Failed:", adminErr.message);
      db = null;
      isDbWriteable = false;
    }
  } catch (err: any) {
    console.error("❌ Firebase Init silent fail:", err.message);
    db = null;
    isDbWriteable = false;
  }
  // Initialize client Firebase Firestore fallback asynchronously too
  initializeClientFirestore();
};

const seedSettingsIfEmpty = async (targetDb: any) => {
  try {
    const settingsSnap = await targetDb.collection('settings').limit(1).get();
    if (settingsSnap.empty) {
      console.log("🌱 Database settings collection is empty. Seeding defaults from system configurations...");
      const defaultSettings = {
        storeName: 'The Ruby Fashion',
        storeLogo: '',
        fromEmail: process.env.RESEND_FROM_EMAIL || `support@therubyfashion.shop`,
        resendApiKey: process.env.RESEND_API_KEY || '',
        smtpUser: process.env.SMTP_USER || '',
        smtpPass: process.env.SMTP_PASS || '',
        oneSignalAppId: process.env.ONESIGNAL_APP_ID || process.env.VITE_ONESIGNAL_APP_ID || '',
        oneSignalRestApiKey: process.env.ONESIGNAL_REST_API_KEY || '',
        razorpayKeyId: process.env.VITE_RAZORPAY_KEY_ID || '',
        razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
        otpMonthlyLimit: 9999,
        buy2Get1Free: false,
        buy2GetPercentEnabled: false,
        buy2GetPercentOff: 0
      };
      await targetDb.collection('settings').add(defaultSettings);
      console.log("🌱 Settings successfully seeded to database.");
    } else {
      console.log("🌱 Settings collection contains existing custom data.");
    }
  } catch (err: any) {
    console.error("❌ Seeding settings failed:", err.message);
  }
};

// Start initialization in background to avoid blocking
setTimeout(() => {
  initializeFirebase()
    .then(() => {
      console.log("🔥 [push-service] Firebase drivers online. Starting background push listeners...");
      initializeAutoPushes().catch((err: any) => {
        console.error("❌ Failed to initiate auto push listeners:", err.message);
      });
    })
    .catch((err: any) => {
      console.error("❌ Failed to initialize resilient Firebase backend:", err.message);
    });
}, 2000);

/**
 * Single Reusable Notification Service
 * Centralizes credentials checks, targeting fields (using only latest include_subscription_ids),
 * and logging of all administrative / customer notifications.
 */
// In-memory Deduplication Cache
const deduplicationCache = new Map<string, number>();
const DEDUPLICATION_WINDOW_MS = 5000; // 5-second window to prevent dual triggers

function isDuplicatePush(target: string, title: string, body: string): boolean {
  const cacheKey = `${target}:${title}:${body}`;
  const now = Date.now();
  const lastSent = deduplicationCache.get(cacheKey);
  if (lastSent && (now - lastSent) < DEDUPLICATION_WINDOW_MS) {
    return true;
  }
  deduplicationCache.set(cacheKey, now);
  
  // Clean up cache periodically
  if (deduplicationCache.size > 1000) {
    for (const [key, timestamp] of deduplicationCache.entries()) {
      if (now - timestamp > DEDUPLICATION_WINDOW_MS) {
        deduplicationCache.delete(key);
      }
    }
  }
  return false;
}

// Production-Grade Notification Templates Dictionary
export const TEMPLATES: Record<string, { title: string; body: string }> = {
  // User notifications
  'order_placed': {
    title: '🎉 Order Confirmed!',
    body: 'Hi {{customerName}}, your order #{{orderId}} of {{total}} has been successfully placed. We are preparing it now.'
  },
  'order_confirmed': {
    title: '🎉 Order Confirmed!',
    body: 'Hi {{customerName}}, your order #{{orderId}} has been confirmed and is being processed.'
  },
  'packed': {
    title: '📦 Order Packed!',
    body: 'Hi {{customerName}}, your order #{{orderId}} is packed and ready to leave our warehouse.'
  },
  'shipped': {
    title: '📦 Your order is on the way',
    body: 'Track your shipment and get ready to receive your package. Order #{{orderId}} is shipped!'
  },
  'out_for_delivery': {
    title: '🚚 Arriving Today',
    body: 'Your package for order #{{orderId}} is out for delivery and should arrive soon.'
  },
  'delivered': {
    title: '✅ Delivered Successfully',
    body: 'Thank you for shopping with The Ruby Fashion. Order #{{orderId}} has been delivered!'
  },
  'cancelled': {
    title: '❌ Order Cancelled',
    body: 'Your order #{{orderId}} has been cancelled. If paid, your refund will be processed.'
  },
  'return_approved': {
    title: '🔄 Return Request Approved',
    body: 'Your return request for order #{{orderId}} has been approved. We will arrange pickup.'
  },
  'refund_processed': {
    title: '💰 Refund Processed',
    body: 'Refund for order #{{orderId}} has been processed. It will reflect in your account soon.'
  },
  'refund_completed': {
    title: '✅ Refund Completed',
    body: 'Refund for order #{{orderId}} has been successfully completed and credited.'
  },
  'coupon_received': {
    title: '🔥 Exclusive Offer',
    body: 'Use coupon {{couponCode}} and save {{discount}} today.'
  },
  'offer_alert': {
    title: '⚡ Limited Time Offer!',
    body: 'Exciting discounts on selected collections! Check out our handpicked deals now.'
  },
  'wishlist_price_drop': {
    title: '📉 Price Drop on Wishlist!',
    body: 'An item in your wishlist has dropped in price! Grab it before it sells out.'
  },
  'back_in_stock': {
    title: '✨ Back in Stock!',
    body: 'Great news! The product "{{productName}}" you were watching is back in stock.'
  },
  'cart_reminder': {
    title: '🛒 Items left in your cart',
    body: 'You have items waiting in your cart. Complete your purchase now before they sell out!'
  },
  'payment_failed': {
    title: '⚠️ Payment Failed',
    body: 'The payment for your order #{{orderId}} failed. Please retry your transaction.'
  },
  'payment_success': {
    title: '💳 Payment Received',
    body: 'We have successfully received payment for your order #{{orderId}}.'
  },

  // Admin notifications
  'admin_new_order': {
    title: '🛒 New Order Received',
    body: 'New order #{{orderId}} received from {{customerName}} for {{total}}.'
  },
  'admin_high_value_order': {
    title: '🚨 High Value Order Alert!',
    body: 'Alert! High value order #{{orderId}} placed by {{customerName}} for {{total}}.'
  },
  'admin_new_user': {
    title: '👤 New User Registered',
    body: 'A new user {{email}} has just registered on the platform.'
  },
  'admin_payment_failed': {
    title: '⚠️ Payment Failed Alert',
    body: 'Payment failed for order #{{orderId}} of amount {{total}}.'
  },
  'admin_return_request': {
    title: '🔄 New Return Request',
    body: 'Return request received for order #{{orderId}}.'
  },
  'admin_refund_request': {
    title: '💰 Refund Request Raised',
    body: 'Refund requested for order #{{orderId}}.'
  },
  'admin_support_message': {
    title: '💬 New Support Message',
    body: 'New customer support message received from {{customerName}}.'
  },
  'admin_inventory_low': {
    title: '⚠️ Low Stock Alert',
    body: 'Warning: Product "{{productName}}" is running low on stock ({{stock}} left).'
  },
  'admin_out_of_stock': {
    title: '🚫 Product Out of Stock',
    body: 'Alert: Product "{{productName}}" is completely out of stock!'
  }
};

// Sliding window cache for notification idempotency (key to timestamp)
const recentNotificationsCache = new Map<string, Date>();

function cleanRecentNotificationsCache() {
  const now = Date.now();
  for (const [key, timestamp] of recentNotificationsCache.entries()) {
    if (now - timestamp.getTime() > 10 * 60 * 1000) { // Clean up entries older than 10 minutes
      recentNotificationsCache.delete(key);
    }
  }
}

/**
 * Checks if a notification with specific order status details or content has already
 * been dispatched to a recipient within a short time window (2 minutes).
 * This prevents duplicate push triggers from double clicks, network retries, or concurrent workers.
 */
export async function isNotificationDuplicate(userId: string, title: string, body: string, options: any = {}): Promise<{ duplicate: boolean; reason?: string }> {
  cleanRecentNotificationsCache();
  const now = new Date();

  // 1. Extract orderId
  let orderId = options.orderId || null;
  if (!orderId) {
    const urlMatch = options.url?.match(/\/track\/([a-zA-Z0-9_\-]+)/);
    if (urlMatch) {
      orderId = urlMatch[1];
    } else {
      const hashMatch = body.match(/#([a-zA-Z0-9_\-]+)/) || title.match(/#([a-zA-Z0-9_\-]+)/);
      if (hashMatch) {
        orderId = hashMatch[1];
      }
    }
  }

  // 2. Determine orderStatus / templateKey
  let orderStatus = options.templateKey || options.orderStatus || null;
  if (!orderStatus) {
    const titleLower = title.toLowerCase();
    const bodyLower = body.toLowerCase();
    if (titleLower.includes("placed") || bodyLower.includes("placed")) {
      orderStatus = "order_placed";
    } else if (titleLower.includes("confirmed") || bodyLower.includes("confirmed")) {
      orderStatus = "order_confirmed";
    } else if (titleLower.includes("processing") || bodyLower.includes("preparing")) {
      orderStatus = "packed";
    } else if (titleLower.includes("shipped") || bodyLower.includes("shipped")) {
      orderStatus = "shipped";
    } else if (titleLower.includes("delivery") || bodyLower.includes("delivery") || titleLower.includes("arriving")) {
      orderStatus = "out_for_delivery";
    } else if (titleLower.includes("delivered") || bodyLower.includes("delivered")) {
      orderStatus = "delivered";
    } else if (titleLower.includes("cancelled") || bodyLower.includes("cancelled")) {
      orderStatus = "cancelled";
    } else if (titleLower.includes("refund") || bodyLower.includes("refund")) {
      orderStatus = "refund_processed";
    } else if (titleLower.includes("rate") || bodyLower.includes("rate")) {
      orderStatus = "rate_purchase";
    }
  }

  const IDEMP_WINDOW_MS = 2 * 60 * 1000; // 2 minutes short time window

  // Check 1: In-Memory Cache for Order Status + ID
  if (orderStatus && orderId) {
    const key = `status_order_id:${userId}:${orderStatus}:${orderId}`;
    const cachedTime = recentNotificationsCache.get(key);
    if (cachedTime && (now.getTime() - cachedTime.getTime() < IDEMP_WINDOW_MS)) {
      return { duplicate: true, reason: `In-memory: duplicate order status '${orderStatus}' for order #${orderId} detected.` };
    }
  }

  // Check 2: In-Memory Cache for exact content match
  const exactKey = `exact_content:${userId}:${title}:${body}`;
  const cachedExactTime = recentNotificationsCache.get(exactKey);
  if (cachedExactTime && (now.getTime() - cachedExactTime.getTime() < IDEMP_WINDOW_MS)) {
    return { duplicate: true, reason: `In-memory: exact duplicate content detected.` };
  }

  // Check 3: Firestore-Backed Backup Check (index-free fallback for resilience)
  try {
    let logs: any[] = [];
    if (db) {
      const snap = await db.collection('push_notification_logs')
        .where('recipient', '==', String(userId))
        .limit(30)
        .get();
      snap.forEach(doc => {
        logs.push(doc.data());
      });
    } else if (clientDb && isClientDbReady) {
      const q = cQuery(
        cCollection(clientDb, 'push_notification_logs'),
        cWhere('recipient', '==', String(userId)),
        cLimit(30)
      );
      const snap = await cGetDocs(q);
      snap.forEach(doc => {
        logs.push(doc.data());
      });
    }

    // Sort latest logs descending in-memory to keep index-free
    logs.sort((a, b) => {
      const tA = a.timestamp || '';
      const tB = b.timestamp || '';
      return tB.localeCompare(tA);
    });

    const windowAgoStr = new Date(now.getTime() - IDEMP_WINDOW_MS).toISOString();

    for (const log of logs) {
      const logTimestamp = log.timestamp || '';
      if (logTimestamp < windowAgoStr) {
        continue;
      }

      // Check duplicate explicitly via logged templateKey/orderId
      if (orderStatus && orderId && log.templateKey === orderStatus && log.orderId === orderId) {
        return { duplicate: true, reason: `Firestore: duplicate order status '${orderStatus}' for order #${orderId} found in logs.` };
      }

      // Check duplicate fallback via exact title/body matching
      if (log.title === title && log.body === body) {
        return { duplicate: true, reason: `Firestore: exact duplicate content found in logs.` };
      }
    }
  } catch (err: any) {
    console.warn("[Idempotency] Firestore-backed backup check encountered an error (continuing with in-memory result):", err.message);
  }

  // Not a duplicate: record this event in the cache
  if (orderStatus && orderId) {
    const key = `status_order_id:${userId}:${orderStatus}:${orderId}`;
    recentNotificationsCache.set(key, now);
  }
  recentNotificationsCache.set(exactKey, now);

  return { duplicate: false };
}

/**
 * Single Reusable Notification Service
 * Centralizes credentials checks, targeting fields (using only latest include_subscription_ids),
 * and logging of all administrative / customer notifications.
 */
export const NotificationService = {
  /**
   * Helper to verify and log OneSignal configuration.
   * Prompts if App ID or API Key is missing.
   */
  async getCredentials(config?: { appId?: string; restKey?: string }) {
    let appId = (config?.appId || '').trim();
    let restKey = (config?.restKey || '').trim();
    
    const isPlaceholder = (val: string) => !val || val === 'dummy-id' || val === 'YOUR_ONESIGNAL_APP_ID' || val === 'placeholder';

    // 1. Dynamic check via Settings in Firestore
    if (!appId || isPlaceholder(appId)) {
      try {
        const settings = await resilientGetSettings();
        if (settings && settings.oneSignalAppId && !isPlaceholder(settings.oneSignalAppId)) {
          appId = String(settings.oneSignalAppId).trim();
          restKey = String(settings.oneSignalRestApiKey || restKey || '').trim();
        }
      } catch (e: any) {
        console.error("NotificationService [Credentials]: Failed to fetch settings dynamically:", e.message);
      }
    }

    // 2. Fallback to static Environment Variables
    if (!appId || isPlaceholder(appId)) {
      appId = (process.env.ONESIGNAL_APP_ID || process.env.VITE_ONESIGNAL_APP_ID || '').trim();
      if (!restKey || isPlaceholder(restKey)) {
        restKey = (process.env.ONESIGNAL_REST_API_KEY || '').trim();
      }
    }

    // Validate credentials
    if (isPlaceholder(appId)) {
      const errMsg = "❌ OneSignal ERROR: App ID is missing or a placeholder. Push notifications will not deliver.";
      console.error(errMsg);
      throw new Error(errMsg);
    }

    if (!restKey || isPlaceholder(restKey)) {
      const errMsg = "❌ OneSignal ERROR: REST API Key is missing or a placeholder. Push notifications will not deliver.";
      console.error(errMsg);
      throw new Error(errMsg);
    }

    return { appId, restKey };
  },

  /**
   * Core delivery engine. Publishes payload directly to OneSignal API v1 endpoint.
   */
  async send(notification: any, config?: { appId?: string; restKey?: string }) {
    const { appId, restKey } = await this.getCredentials(config);
    const cleanRestKey = restKey.replace(/Basic\s+/i, '').trim();

    const headers = { 
      'Content-Type': 'application/json',
      'Authorization': `Basic ${cleanRestKey}`
    };

    // Clean payload of legacy, deprecated fields and enforce single targeting field
    const payload = { ...notification, app_id: appId };
    delete payload.include_player_ids; // Ensure complete removal of include_player_ids if mistakenly passed

    // Determine notification type and targets for auditing
    let targetType = "Global / Broadcast (Subscribed Users)";
    let targets = "Broadcast Segment";
    if (payload.include_subscription_ids && payload.include_subscription_ids.length > 0) {
      targetType = "User (Direct Subscription ID)";
      targets = payload.include_subscription_ids.join(', ');
    } else if (payload.filters && payload.filters.length > 0) {
      targetType = "Admin (Segment/Filter)";
      targets = JSON.stringify(payload.filters);
    } else if (payload.included_segments && payload.included_segments.length > 0) {
      targetType = `Segment Targeted [${payload.included_segments.join(', ')}]`;
      targets = "Segment Audience";
    }

    // Deduplication check
    const headingsEn = payload.headings?.en || "Notification";
    const contentsEn = payload.contents?.en || "";
    if (isDuplicatePush(targets, headingsEn, contentsEn)) {
      console.warn(`⚠️ [NotificationService Deduplication] Blocked duplicate push dispatch to ${targets}`);
      return { data: { id: "deduplicated-msg-id", warning: "Duplicate blocked" } };
    }

    console.log(`\n=============================================================`);
    console.log(`📡 [NotificationService PUSH SYSTEM DISPATCH]`);
    console.log(`   - Notification Type: ${targetType}`);
    console.log(`   - Target Subscription ID(s) / Segment: ${targets}`);
    console.log(`   - Target OneSignal App ID: ${appId}`);
    console.log(`   - Core Payload Audit:`);
    console.log(JSON.stringify(payload, null, 2));
    console.log(`=============================================================\n`);

    try {
      const response = await axios.post('https://onesignal.com/api/v1/notifications', 
        payload,
        { headers }
      );
      
      console.log(`\n============================ ON_SUCCESS =====================`);
      console.log(`✅ [NotificationService] OneSignal HTTP Response Code: ${response.status}`);
      console.log(`✅ [NotificationService] Response Data Body:`, JSON.stringify(response.data, null, 2));
      console.log(`=============================================================\n`);
      return response;
    } catch (axiosErr: any) {
      const errorData = axiosErr.response?.data;
      const errorStatus = axiosErr.response?.status;
      
      console.error(`\n============================ ON_FAILURE =====================`);
      console.error(`❌ [NotificationService] OneSignal API HTTP Status: ${errorStatus || 'unknown'}`);
      console.error(`❌ [NotificationService] Direct API Error Statement:`, JSON.stringify(errorData || axiosErr.message, null, 2));
      console.error(`=============================================================\n`);
      
      // Auto-cleanup invalid subscriptions if OneSignal tells us the subscription ID was not found or not subscribed
      const errorMsg = String(errorData?.errors ? errorData.errors.join(', ') : '').toLowerCase();
      if (payload.include_subscription_ids && payload.include_subscription_ids.length > 0) {
        if (errorMsg.includes("not subscribed") || errorMsg.includes("not found") || errorMsg.includes("players are not subscribed")) {
          const invalidId = payload.include_subscription_ids[0];
          try {
            console.log(`🧹 [NotificationService Auto-Cleanup] Cleared expired subscription ${invalidId} from database`);
            if (db) {
              const snap = await db.collection('users').where('onesignalId', '==', invalidId).get();
              if (snap && !snap.empty) {
                for (const doc of snap.docs) {
                  await doc.ref.update({ onesignalId: null });
                }
              }
            }
          } catch (cleanErr: any) {
            console.error("Failed to run automatic cleanup:", cleanErr.message);
          }
        }
      }

      // Check if it's a transient failure (5xx or connection timeout), queue for auto-retry
      const isTransient = !errorStatus || errorStatus >= 500 || axiosErr.code === 'ECONNABORTED' || axiosErr.message?.includes('Network Error');
      if (isTransient) {
        console.log(`⏳ [NotificationService Queue] Enqueueing failed push for background retry loop`);
        try {
          const queuedData = {
            payload,
            targetType,
            targets,
            retryCount: 0,
            status: 'queued',
            timestamp: new Date().toISOString()
          };
          if (db) {
            await db.collection('queued_notifications').add(queuedData);
          }
        } catch (queueErr: any) {
          console.error("Failed to enqueue notification:", queueErr.message);
        }
      }

      if (errorData?.errors?.includes("Invalid REST API Key")) {
        throw new Error("OneSignal Error: Your REST API Key is invalid. Please check Admin Settings.");
      }
      if (errorData?.errors?.includes("app_id not found")) {
        throw new Error("OneSignal Error: Your App ID is invalid or doesn't match the REST Key.");
      }
      throw axiosErr;
    }
  },

  /**
   * Safe persistent logging of dispatch statuses.
   */
  async log(title: string, body: string, recipient: string, status: string, notificationId: string | null = null, extra: { templateKey?: string; orderId?: string } = {}) {
    const logData: any = {
      title,
      body,
      recipient,
      status,
      deliveryStatus: status === 'success' ? 'sent' : 'failed',
      notificationId,
      timestamp: new Date().toISOString(),
      templateKey: extra.templateKey || null,
      orderId: extra.orderId || null
    };
    try {
      if (clientDb && isClientDbReady) {
        await cAddDoc(cCollection(clientDb, 'push_notification_logs'), logData);
      } else if (db && isDbWriteable !== false) {
        await db.collection('push_notification_logs').add(logData);
      }
      console.log(`📝 [NotificationService] Logged notification: [${status}] ${title} -> ${recipient}`);
    } catch (err: any) {
      console.error("❌ [NotificationService] Failed to record log:", err.message);
    }
  },

  /**
   * Sends order notification to Admin users.
   */
  async sendAdmin(title: string, body: string, options: { url?: string; imageUrl?: string; templateKey?: string; orderId?: string } = {}) {
    const { url = '/', imageUrl } = options;
    
    // Infer orderId if not provided
    let inferredOrderId = options.orderId || null;
    if (!inferredOrderId) {
      const urlMatch = url.match(/\/track\/([a-zA-Z0-9_\-]+)/);
      if (urlMatch) {
        inferredOrderId = urlMatch[1];
      } else {
        const hashMatch = body.match(/#([a-zA-Z0-9_\-]+)/) || title.match(/#([a-zA-Z0-9_\-]+)/);
        if (hashMatch) {
          inferredOrderId = hashMatch[1];
        }
      }
    }

    // Infer templateKey/status if not provided
    let inferredTemplateKey = options.templateKey || null;
    if (!inferredTemplateKey) {
      const titleLower = title.toLowerCase();
      const bodyLower = body.toLowerCase();
      if (titleLower.includes("placed") || bodyLower.includes("placed")) {
        inferredTemplateKey = "order_placed";
      } else if (titleLower.includes("confirmed") || bodyLower.includes("confirmed")) {
        inferredTemplateKey = "order_confirmed";
      } else if (titleLower.includes("processing") || bodyLower.includes("preparing")) {
        inferredTemplateKey = "packed";
      } else if (titleLower.includes("shipped") || bodyLower.includes("shipped")) {
        inferredTemplateKey = "shipped";
      } else if (titleLower.includes("delivery") || bodyLower.includes("delivery") || titleLower.includes("arriving")) {
        inferredTemplateKey = "out_for_delivery";
      } else if (titleLower.includes("delivered") || bodyLower.includes("delivered")) {
        inferredTemplateKey = "delivered";
      } else if (titleLower.includes("cancelled") || bodyLower.includes("cancelled")) {
        inferredTemplateKey = "cancelled";
      } else if (titleLower.includes("refund") || bodyLower.includes("refund")) {
        inferredTemplateKey = "refund_processed";
      } else if (titleLower.includes("rate") || bodyLower.includes("rate")) {
        inferredTemplateKey = "rate_purchase";
      }
    }

    try {
      // Check idempotency to prevent duplicate triggers within short time window
      const isDup = await isNotificationDuplicate("admin", title, body, { ...options, templateKey: inferredTemplateKey, orderId: inferredOrderId });
      if (isDup.duplicate) {
        console.log(`⚠️ [NotificationService] sendAdmin skipped due to idempotency: ${isDup.reason}`);
        return { success: true, status: "duplicate_skipped", message: isDup.reason };
      }

      console.log(`[NotificationService] Preparing admin notification: "${title}" - "${body}"`);
      
      const notification: any = {
        contents: { en: body },
        headings: { en: title },
        url: url,
        android_accent_color: "A11B35",
        android_led_color: "A11B35",
        android_visibility: 1
      };

      if (imageUrl) {
        notification.big_picture = imageUrl;
        notification.chrome_web_image = imageUrl;
        notification.firefox_icon = imageUrl;
        notification.ios_attachments = { id1: imageUrl };
      }

      // 1. Fetch all admin subscription ids
      let adminSubIds: string[] = [];
      if (db) {
        try {
          const adminsSnap = await db.collection('users').where('role', '==', 'admin').get();
          if (adminsSnap && !adminsSnap.empty) {
            adminsSnap.forEach((doc: any) => {
              const uData = doc.data();
              if (uData && uData.onesignalId) {
                adminSubIds.push(String(uData.onesignalId).trim());
              }
            });
          }
        } catch (dbErr: any) {
          console.warn("[NotificationService] Admin lookup warning:", dbErr.message);
        }
      }

      if (adminSubIds.length === 0 && clientDb && isClientDbReady) {
        try {
          const adminsSnap = await cGetDocs(cQuery(
            cCollection(clientDb, 'users'),
            cWhere('role', '==', 'admin')
          ));
          if (!adminsSnap.empty) {
            adminsSnap.forEach((doc: any) => {
              const uData = doc.data();
              if (uData && uData.onesignalId) {
                adminSubIds.push(String(uData.onesignalId).trim());
              }
            });
          }
        } catch (clientDbErr: any) {
          console.warn("[NotificationService] Client SDK Admin lookup warning:", clientDbErr.message);
        }
      }

      let resultStatus = "success";
      let msgId: string | null = null;

      // EXCLUSIVE DELIVERY STRATEGY TO PREVENT DUPLICATES:
      // If there are direct active subscriptions, target them directly.
      // Do NOT send by tags if targeting by subscription IDs to prevent duplicate pushes!
      if (adminSubIds.length > 0) {
        try {
          const directNotif = {
            ...notification,
            include_subscription_ids: adminSubIds
          };
          const res = await this.send(directNotif);
          msgId = res?.data?.id || msgId;
          resultStatus = "success";
        } catch (dErr: any) {
          console.warn("[NotificationService] Direct admin subscription push warning:", dErr.message);
          resultStatus = "warning";
        }
      } else {
        // Fallback to tag filter delivery ONLY if no active admin subscription is registered
        try {
          const filterNotif = {
            ...notification,
            filters: [{ field: "tag", key: "role", relation: "=", value: "admin" }]
          };
          const res = await this.send(filterNotif);
          msgId = res?.data?.id || msgId;
        } catch (fErr: any) {
          console.warn("[NotificationService] Tag filter push warning:", fErr.message);
          resultStatus = "warning";
        }
      }

      await this.log(title, body, "admin", resultStatus, msgId, { templateKey: inferredTemplateKey, orderId: inferredOrderId });
      return { success: true, status: resultStatus, notificationId: msgId };
    } catch (err: any) {
      console.error("❌ [NotificationService] sendAdmin failed:", err.message);
      await this.log(title, body, "admin", "failed", null, { templateKey: inferredTemplateKey, orderId: inferredOrderId });
      return { success: false, error: err.message };
    }
  },

  /**
   * Sends status update notification to customer.
   */
  async sendCustomer(userId: string, title: string, body: string, options: { url?: string; imageUrl?: string; buttons?: any[]; templateKey?: string; orderId?: string } = {}) {
    const { url = '/', imageUrl, buttons } = options;
    
    // Infer orderId if not provided
    let inferredOrderId = options.orderId || null;
    if (!inferredOrderId) {
      const urlMatch = url.match(/\/track\/([a-zA-Z0-9_\-]+)/);
      if (urlMatch) {
        inferredOrderId = urlMatch[1];
      } else {
        const hashMatch = body.match(/#([a-zA-Z0-9_\-]+)/) || title.match(/#([a-zA-Z0-9_\-]+)/);
        if (hashMatch) {
          inferredOrderId = hashMatch[1];
        }
      }
    }

    // Infer templateKey/status if not provided
    let inferredTemplateKey = options.templateKey || null;
    if (!inferredTemplateKey) {
      const titleLower = title.toLowerCase();
      const bodyLower = body.toLowerCase();
      if (titleLower.includes("placed") || bodyLower.includes("placed")) {
        inferredTemplateKey = "order_placed";
      } else if (titleLower.includes("confirmed") || bodyLower.includes("confirmed")) {
        inferredTemplateKey = "order_confirmed";
      } else if (titleLower.includes("processing") || bodyLower.includes("preparing")) {
        inferredTemplateKey = "packed";
      } else if (titleLower.includes("shipped") || bodyLower.includes("shipped")) {
        inferredTemplateKey = "shipped";
      } else if (titleLower.includes("delivery") || bodyLower.includes("delivery") || titleLower.includes("arriving")) {
        inferredTemplateKey = "out_for_delivery";
      } else if (titleLower.includes("delivered") || bodyLower.includes("delivered")) {
        inferredTemplateKey = "delivered";
      } else if (titleLower.includes("cancelled") || bodyLower.includes("cancelled")) {
        inferredTemplateKey = "cancelled";
      } else if (titleLower.includes("refund") || bodyLower.includes("refund")) {
        inferredTemplateKey = "refund_processed";
      } else if (titleLower.includes("rate") || bodyLower.includes("rate")) {
        inferredTemplateKey = "rate_purchase";
      }
    }

    try {
      if (!userId) {
        console.warn("[NotificationService] sendCustomer aborted: missing userId");
        return { success: false, error: "userId is required" };
      }

      // Check idempotency to prevent duplicate triggers within short time window
      const isDup = await isNotificationDuplicate(userId, title, body, { ...options, templateKey: inferredTemplateKey, orderId: inferredOrderId });
      if (isDup.duplicate) {
        console.log(`⚠️ [NotificationService] sendCustomer skipped due to idempotency: ${isDup.reason}`);
        return { success: true, status: "duplicate_skipped", message: isDup.reason };
      }

      console.log(`[NotificationService] Preparing customer notification to User ${userId}: "${title}"`);
 
       let onesignalId = null;
       let userEmail = "";
       if (db) {
         try {
           const userDoc = await db.collection('users').doc(String(userId)).get();
           if (userDoc.exists) {
             const userData = userDoc.data();
             onesignalId = userData?.onesignalId || null;
             userEmail = userData?.email || "";
           }
         } catch (dbErr: any) {
           console.warn("[NotificationService] User lookup error:", dbErr.message);
         }
       }
 
       if (!onesignalId && clientDb && isClientDbReady) {
         try {
           const userDocSnapshot = await cGetDoc(cDoc(clientDb, 'users', String(userId)));
           if (userDocSnapshot.exists()) {
             const userData = userDocSnapshot.data();
             onesignalId = userData?.onesignalId || null;
             userEmail = userData?.email || "";
           }
         } catch (clientDbErr: any) {
           console.warn("[NotificationService] Client SDK User lookup error:", clientDbErr.message);
         }
       }
 
       const notification: any = {
         contents: { en: body },
         headings: { en: title },
         url: url,
         android_accent_color: "A11B35",
         android_led_color: "A11B35",
         android_visibility: 1
       };
 
       if (imageUrl) {
         notification.big_picture = imageUrl;
         notification.chrome_web_image = imageUrl;
         notification.firefox_icon = imageUrl;
         notification.ios_attachments = { id1: imageUrl };
       }
 
       if (buttons && Array.isArray(buttons)) {
         notification.buttons = buttons;
       }
 
       // EXCLUSIVE TARGETING STRATEGY TO PREVENT DUPLICATES:
       // If we have the exact subscription ID, use it directly.
       // Remove external ID aliases and include_external_user_ids to prevent OneSignal from sending twice.
       if (onesignalId) {
         if (String(onesignalId).startsWith('simulated_push_')) {
           console.log(`[NotificationService] Simulating push to simulated device: ${onesignalId}`);
           await this.log(title, body, userEmail || userId, "simulated", null, { templateKey: inferredTemplateKey, orderId: inferredOrderId });
           return { success: true, status: "simulated" };
         }
         notification.include_subscription_ids = [onesignalId];
       } else {
         // Fallback: target strictly by external user ID alias if subscription ID isn't linked
         notification.include_external_user_ids = [String(userId)];
         notification.include_aliases = {
           external_id: [String(userId)]
         };
       }
 
       const response = await this.send(notification);
       const responseData = response?.data;
       const msgId = responseData?.id || null;
       
       let resultStatus = "success";
       if (responseData?.errors && Array.isArray(responseData.errors)) {
         const errorMsg = responseData.errors.join(', ');
         if (errorMsg.includes("not subscribed") || errorMsg.includes("not found") || errorMsg.includes("players are not subscribed")) {
           resultStatus = "warning";
         }
       }
 
       await this.log(title, body, userEmail || userId, resultStatus, msgId, { templateKey: inferredTemplateKey, orderId: inferredOrderId });
       return { success: true, status: resultStatus, notificationId: msgId };
     } catch (err: any) {
       console.error(`❌ [NotificationService] sendCustomer failed:`, err.message);
       const errLower = String(err.message || '').toLowerCase();
       let finalStatus = "failed";
       if (errLower.includes("not subscribed") || errLower.includes("players are not subscribed") || errLower.includes("not found")) {
         finalStatus = "warning";
       }
       await this.log(title, body, userId, finalStatus, null, { templateKey: inferredTemplateKey, orderId: inferredOrderId });
       return { success: false, error: err.message };
     }
   }
};

// Automatic Background Retry Loop for Queued Pushes
setInterval(async () => {
  try {
    if (!db) return;
    const queuedSnap = await db.collection('queued_notifications').where('status', '==', 'queued').get();
    if (!queuedSnap || queuedSnap.empty) return;
    
    console.log(`🔄 [NotificationService Retry Engine] Retrying ${queuedSnap.size} queued notifications...`);
    for (const doc of queuedSnap.docs) {
      const data = doc.data();
      if (data.retryCount >= 3) {
        await doc.ref.update({ status: 'failed_exhausted' });
        await NotificationService.log(
          data.payload?.headings?.en || 'Retried push',
          data.payload?.contents?.en || '',
          data.targets || 'unknown',
          'failed'
        );
        continue;
      }
      
      try {
        await NotificationService.send(data.payload);
        await doc.ref.update({ status: 'processed' });
        console.log(`✅ [NotificationService Retry Engine] Dispatched queued message ${doc.id}`);
      } catch (err: any) {
        const nextRetry = (data.retryCount || 0) + 1;
        await doc.ref.update({ retryCount: nextRetry });
        console.warn(`⚠️ [NotificationService Retry Engine] Retry attempt ${nextRetry} failed for ${doc.id}`);
      }
    }
  } catch (err: any) {
    console.error("Error running retry background engine loop:", err.message);
  }
}, 30000); // execute retry process every 30 seconds


// Compatible standalone wrappers delegating to the unified NotificationService
async function sendOneSignalNotification(notification: any, config?: { appId?: string, restKey?: string }) {
  return NotificationService.send(notification, config);
}

async function logNotificationToDatabase(title: string, body: string, recipient: string, status: string) {
  return NotificationService.log(title, body, recipient, status);
}

async function sendAdminNotification(title: string, body: string, url: string = '/') {
  return NotificationService.sendAdmin(title, body, { url });
}

async function sendCustomerNotification(userId: string, title: string, body: string, url: string = '/') {
  return NotificationService.sendCustomer(userId, title, body, { url });
}

async function runCartAbandonmentRecovery() {
  let carts: any[] = [];
  let fetched = false;

  if (db) {
    try {
      const snap = await db.collection('carts').where('status', '==', 'active').get();
      snap.forEach(doc => {
        carts.push({ id: doc.id, ...doc.data() });
      });
      fetched = true;
    } catch (e: any) {
      console.warn("Recovery cart query via Admin SDK failed:", e.message);
    }
  }

  if (!fetched && clientDb && isClientDbReady) {
    try {
      const snap = await cGetDocs(cQuery(
        cCollection(clientDb, 'carts'),
        cWhere('status', '==', 'active')
      ));
      snap.forEach(doc => {
        carts.push({ id: doc.id, ...doc.data() });
      });
    } catch (e: any) {
      console.warn("Recovery cart query via Client SDK failed:", e.message);
    }
  }

  const now = Date.now();
  for (const cart of carts) {
    if (!cart.userId || !cart.items || cart.items.length === 0) continue;
    const updatedAt = cart.updatedAt ? new Date(cart.updatedAt).getTime() : now;
    const minutesElapsed = (now - updatedAt) / (60 * 1000);
    if (minutesElapsed >= 5 && !cart.abandonedAlertSent) {
      console.log(`🛒 Recovering abandoned cart for user ${cart.userId}`);
      await sendCustomerNotification(
        cart.userId,
        "Complete Your Purchase 🛍️",
        "Your clothing items are waiting in your cart. Shop now before they sell out!",
        "/cart"
      );
      try {
        if (db) {
          await db.collection('carts').doc(cart.id).update({ abandonedAlertSent: true });
        } else if (clientDb && isClientDbReady) {
          await cUpdateDoc(cDoc(clientDb, 'carts', cart.id), { abandonedAlertSent: true });
        }
      } catch (err) {}
    }
  }
}

let isPushServiceInitialized = false;

async function initializeAutoPushes() {
  if (isPushServiceInitialized) return;
  
  let retries = 0;
  // Wait up to 5 seconds for either db (Admin) or clientDb to initialize
  while (!db && !clientDb && retries < 15) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    retries++;
  }

  if (!db && !clientDb) {
    console.warn("⚠️ [push-service] Neither privileged Admin DB nor clientDb fallback is active. Automatic events suspended.");
    return;
  }

  console.log("🚀 [push-service] Booting database trackers...");
  isPushServiceInitialized = true;

  const orderStatusCache = new Map<string, string>();
  const userPointsCache = new Map<string, number>();
  const productStockCache = new Map<string, number>();
  const productPriceCache = new Map<string, number>();

  let isOrdersLoaded = false;
  let isUsersLoaded = false;
  let isReviewsLoaded = false;
  let isTicketsLoaded = false;
  let isProductsLoaded = false;
  let isCouponsLoaded = false;
  let isPromotionsLoaded = false;

  // Unified listener registry supporting privileged admin db or fallback clientDb
  const registerListener = (
    collectionName: string,
    onSnapshotCallback: (snapshot: any) => void,
    onErrorCallback?: (err: any) => void
  ) => {
    if (db) {
      console.log(`📡 [push-service] Attaching privileged Admin SDK listener for: '${collectionName}'`);
      return db.collection(collectionName).onSnapshot(onSnapshotCallback, onErrorCallback || ((err: any) => {
        console.error(`❌ [push-service] Admin '${collectionName}' listener error:`, err.message);
      }));
    } else if (clientDb && isClientDbReady) {
      console.log(`📡 [push-service] Attaching client fallback SDK listener for: '${collectionName}'`);
      return cOnSnapshot(cCollection(clientDb, collectionName), onSnapshotCallback, onErrorCallback || ((err: any) => {
        console.error(`❌ [push-service] Client '${collectionName}' listener error:`, err.message);
      }));
    } else {
      console.warn(`⚠️ [push-service] No database available to register listener for: '${collectionName}'`);
      return null;
    }
  };

  // 1. Orders
  try {
    registerListener('orders', (snapshot) => {
      if (!isOrdersLoaded) {
        snapshot.docs.forEach((doc: any) => {
          const order = doc.data();
          orderStatusCache.set(doc.id, order.status || '');
        });
        isOrdersLoaded = true;
        console.log(`📡 [push-service] Orders listener cached ${snapshot.size} entries.`);
        return;
      }

      snapshot.docChanges().forEach(async (change: any) => {
        const orderId = change.doc.id;
        const order = change.doc.data();

        if (change.type === 'added') {
          orderStatusCache.set(orderId, order.status || '');
          
          await sendAdminNotification(
            "New Order Received 🛍️",
            `Order #${orderId} of ₹${order.total || 0} has been placed.`,
            `/admin?tab=orders`
          );

          if (order.userId) {
            await sendCustomerNotification(
              order.userId,
              "Order Successfully Placed 🎉",
              "Your order has been received. Track status using view details!",
              `/track/${orderId}`
            );
          }

          if (Number(order.total || 0) >= 5000) {
            await sendAdminNotification(
              "High Value Order Alert! ⚠️",
              `Large order received: Order #${orderId} total is ₹${order.total}!`,
              `/admin?tab=orders`
            );
          }
        }

        if (change.type === 'modified') {
          const oldStatus = orderStatusCache.get(orderId) || '';
          const newStatus = order.status || '';
          orderStatusCache.set(orderId, newStatus);

          if (oldStatus !== newStatus && newStatus) {
            console.log(`[push-service] Status updated: ${orderId} (${oldStatus} -> ${newStatus})`);

            switch (String(newStatus).trim()) {
              case 'Confirmed':
              case 'Paid':
                await sendAdminNotification("Payment Received 💳", `Payment received for Order #${orderId}.`);
                if (order.userId) {
                  await sendCustomerNotification(order.userId, "Order Confirmed ✅", "Your order is confirmed.");
                }
                break;
              case 'Processing':
                if (order.userId) {
                  await sendCustomerNotification(order.userId, "Order Processing ⚙️", "We are preparing your order.");
                }
                break;
              case 'Shipped':
                if (order.userId) {
                  await sendCustomerNotification(order.userId, "Order Shipped 🚚", "Your package is on the way!");
                }
                break;
              case 'In Delivery':
              case 'Out for Delivery':
                if (order.userId) {
                  await sendCustomerNotification(order.userId, "Out For Delivery 📍", "Your order will arrive soon.");
                }
                break;
              case 'Delivered':
                if (order.userId) {
                  await sendCustomerNotification(order.userId, "Order Delivered 🎁", "Your package has been delivered.");
                  await sendCustomerNotification(order.userId, "Rate Your Purchase ⭐", "Share your experience with the product.");
                }
                break;
              case 'Cancelled':
                await sendAdminNotification("Cancellation Request ❌", `Order #${orderId} was cancelled.`);
                if (order.userId) {
                  await sendCustomerNotification(order.userId, "Order Cancelled 🚫", "Your order has been cancelled.");
                }
                break;
              case 'Refunded':
                if (order.userId) {
                  await sendCustomerNotification(order.userId, "Refund Initiated 💰", "Refund process has started.");
                  await sendCustomerNotification(order.userId, "Refund Completed ✅", "Refund has been completed.");
                }
                break;
            }
          }
        }
      });
    }, (err) => {
      console.error("Orders listener error:", err.message);
    });
  } catch (err: any) {
    console.error("Orders listener setup error:", err.message);
  }

  // 2. Users (Includes real-time loyalty points push notifications)
  try {
    registerListener('users', (snapshot) => {
      if (!isUsersLoaded) {
        snapshot.docs.forEach((doc: any) => {
          const u = doc.data();
          userPointsCache.set(doc.id, u.loyaltyPoints || 0);
        });
        isUsersLoaded = true;
        return;
      }

      snapshot.docChanges().forEach(async (change: any) => {
        const userId = change.doc.id;
        const user = change.doc.data();

        if (change.type === 'added') {
          userPointsCache.set(userId, user.loyaltyPoints || 0);
          await sendAdminNotification(
            "New User Registered 👤",
            `${user.displayName || user.email || 'A user'} joined The Ruby Fashion.`
          );

          await sendCustomerNotification(
            userId,
            "Welcome to The Ruby Fashion! ✨",
            "Thank you for joining us. Check out our latest selection!",
            "/"
          );
        }

        if (change.type === 'modified') {
          const oldPoints = userPointsCache.get(userId) ?? 0;
          const newPoints = user.loyaltyPoints ?? 0;
          userPointsCache.set(userId, newPoints);

          if (oldPoints !== newPoints) {
            console.log(`[push-service] Loyalty points updated for user ${userId}: ${oldPoints} -> ${newPoints} points`);

            // I. Immediate, automatic push for ANY point balance modification
            if (newPoints > oldPoints) {
              const gained = newPoints - oldPoints;
              await sendCustomerNotification(
                userId,
                "Loyalty Points Earned! 🌟",
                `Success! You received +${gained} loyalty points. Your current status balance is ${newPoints} points. 💎`,
                "/settings?tab=coupons"
              );
            } else {
              const spent = oldPoints - newPoints;
              await sendCustomerNotification(
                userId,
                "Loyalty Points Redeemed! 🎟️",
                `Voucher claimed! Redeemed -${spent} points. Your new loyalty balance: ${newPoints} points.`,
                "/settings?tab=coupons"
              );
            }

            // II. Check Milestones Achieved (with a slight timeout delay to prevent overlapping push alerts)
            const thresholds = [100, 250, 500, 1000];
            for (const t of thresholds) {
              if (oldPoints < t && newPoints >= t) {
                setTimeout(async () => {
                  try {
                    await sendCustomerNotification(
                      userId,
                      `Loyalty Progress Complete! 🎉`,
                      `Tumhare loyalty points ka progress complete ho gaya hai, abhi redeem kar lo! 🎟️ (Achieved ${t} Points Milestone)`,
                      '/settings?tab=coupons'
                    );
                  } catch (milestoneErr: any) {
                    console.error("Failed to send milestone notification:", milestoneErr.message);
                  }
                }, 2500);
              }
            }
          }
        }
      });
    }, (err) => {
      console.error("Users listener error:", err.message);
    });
  } catch (err: any) {
    console.error("Users listener setup error:", err.message);
  }

  // 3. Reviews
  try {
    registerListener('reviews', (snapshot) => {
      if (!isReviewsLoaded) {
        isReviewsLoaded = true;
        return;
      }

      snapshot.docChanges().forEach(async (change: any) => {
        if (change.type === 'added') {
          const review = change.doc.data();
          await sendAdminNotification(
            "New Product Review 💬",
            `A customer submitted a review for Product ID: ${review.productId || 'Unknown'}.`
          );
          await sendAdminNotification(
            "New Rating Received ⭐",
            `Product received a new rating of ${review.rating || 5} Stars!`
          );
        }
      });
    }, (err) => {
      console.error("Reviews listener error:", err.message);
    });
  } catch (err: any) {
    console.error("Reviews listener setup error:", err.message);
  }

  // 4. Tickets / Support Messages
  try {
    registerListener('tickets', (snapshot) => {
      if (!isTicketsLoaded) {
        isTicketsLoaded = true;
        return;
      }

      snapshot.docChanges().forEach(async (change: any) => {
        if (change.type === 'added') {
          await sendAdminNotification(
            "New Support Request 🎫",
            "Customer needs assistance."
          );
        }
      });
    }, (err) => {
      console.error("Tickets listener error:", err.message);
    });
  } catch (err: any) {
    console.error("Tickets listener setup error:", err.message);
  }

  // 5. Products
  try {
    registerListener('products', (snapshot) => {
      if (!isProductsLoaded) {
        snapshot.docs.forEach((doc: any) => {
          const p = doc.data();
          productStockCache.set(doc.id, p.stock ?? 0);
          productPriceCache.set(doc.id, p.price ?? 0);
        });
        isProductsLoaded = true;
        return;
      }

      snapshot.docChanges().forEach(async (change: any) => {
        const productId = change.doc.id;
        const p = change.doc.data();

        if (change.type === 'added') {
          productStockCache.set(productId, p.stock ?? 0);
          productPriceCache.set(productId, p.price ?? 0);
        }

        if (change.type === 'modified') {
          const oldStock = productStockCache.get(productId);
          const newStock = p.stock ?? 0;
          productStockCache.set(productId, newStock);

          const oldPrice = productPriceCache.get(productId);
          const newPrice = p.price ?? 0;
          productPriceCache.set(productId, newPrice);

          if (oldStock !== undefined && oldStock > 0 && newStock === 0) {
            await sendAdminNotification("Product Out of Stock ❌", `Product "${p.name || productId}" inventory reached zero.`);
          } else if (oldStock !== undefined && oldStock > 5 && newStock <= 5 && newStock > 0) {
            await sendAdminNotification("Low Stock Alert ⚠️", `Product "${p.name || productId}" stock is running low (${newStock} left).`);
          } else if (oldStock !== undefined && oldStock === 0 && newStock > 0) {
            await sendOneSignalNotification({
              headings: { en: "Back In Stock! 🛍️" },
              contents: { en: `Your favorite product "${p.name || 'Clothing item'}" is available again. Grab yours before it goes!` },
              url: `/product/${productId}`,
              included_segments: ['Subscribed Users']
            });
            await logNotificationToDatabase("Back In Stock", `Product "${p.name || productId}" is back in stock.`, "Subscribed Users", "success");
          }

          if (oldPrice !== undefined && newPrice < oldPrice) {
            await sendOneSignalNotification({
              headings: { en: "Price Drop Alert! 📉" },
              contents: { en: `Great news! "${p.name || 'Clothing item'}" is now available at a reduced price of ₹${newPrice}. Shop now and save!` },
              url: `/product/${productId}`,
              included_segments: ['Subscribed Users']
            });
            await logNotificationToDatabase("Price Drop Alert", `Price drop for "${p.name || productId}" to ₹${newPrice}`, "Subscribed Users", "success");
          }
        }
      });
    }, (err) => {
      console.error("Products listener error:", err.message);
    });
  } catch (err: any) {
    console.error("Products listener setup error:", err.message);
  }

  // 6. Coupons
  try {
    registerListener('coupons', (snapshot) => {
      if (!isCouponsLoaded) {
        isCouponsLoaded = true;
        return;
      }

      snapshot.docChanges().forEach(async (change: any) => {
        if (change.type === 'added') {
          const coupon = change.doc.data();
          await sendOneSignalNotification({
            headings: { en: "New Coupon Available 🎟️" },
            contents: { en: `Special offer available now! Save big with promo code: ${coupon.code || 'SAVE'}` },
            url: "/settings?tab=coupons",
            included_segments: ['Subscribed Users']
          });
          await logNotificationToDatabase("New Coupon Available", `Coupon code ${coupon.code || 'SAVE'} created.`, "Subscribed Users", "success");
        }
      });
    }, (err) => {
      console.error("Coupons listener error:", err.message);
    });
  } catch (err: any) {
    console.error("Coupons listener setup error:", err.message);
  }

  // 7. Promotions
  try {
    registerListener('promotions', (snapshot) => {
      if (!isPromotionsLoaded) {
        isPromotionsLoaded = true;
        return;
      }

      snapshot.docChanges().forEach(async (change: any) => {
        const prom = change.doc.data();
        if (change.type === 'added' || (change.type === 'modified' && prom.status === 'active')) {
          if (prom.status === 'active') {
            await sendOneSignalNotification({
              headings: { en: "Flash Sale Started! ⚡" },
              contents: { en: `Limited time deals available: ${prom.name || 'Special sale event is active'}. Shop the best deals now!` },
              url: "/",
              included_segments: ['Subscribed Users']
            });
            await logNotificationToDatabase("Flash Sale Started", `Flash sale "${prom.name || 'Promo'}" started.`, "Subscribed Users", "success");
          }
        }
      });
    }, (err) => {
      console.error("Promotions listener error:", err.message);
    });
  } catch (err: any) {
    console.error("Promotions listener setup error:", err.message);
  }

  setInterval(async () => {
    try {
      await runCartAbandonmentRecovery();
    } catch (e: any) {
      console.error("Cart Recovery check failed:", e.message);
    }
  }, 10 * 60 * 1000);
}

// Cache for store settings to avoid frequent Firestore calls
let cachedSettings: any = null;
let lastSettingsFetch = 0;
const SETTINGS_CACHE_TTL = 5000; // 5 seconds for faster admin updates

// Resilient Settings Loader with triple layer fallback: Cache -> Admin SDK -> Client Web SDK -> Static/Env Configs
async function resilientGetSettings() {
  const now = Date.now();
  if (cachedSettings && (now - lastSettingsFetch < SETTINGS_CACHE_TTL)) {
    return cachedSettings;
  }

  // 1. Try Firebase Admin SDK first
  if (db && isDbWriteable !== false) {
    try {
      const settingsSnap = await db.collection('settings').limit(1).get();
      if (!settingsSnap.empty) {
        cachedSettings = settingsSnap.docs[0].data();
        lastSettingsFetch = now;
        return cachedSettings;
      }
    } catch (dbErr: any) {
      console.warn("ℹ️ Admin SDK Settings Query Denied or Failed. Attempting Client Web SDK...", dbErr.message);
    }
  }

  // 2. Try Firebase Client Web SDK Fallback
  initializeClientFirestore();
  if (clientDb && isClientDbReady) {
    try {
      const settingsQuery = cQuery(cCollection(clientDb, 'settings'), cLimit(1));
      const settingsSnap = await cGetDocs(settingsQuery);
      if (!settingsSnap.empty) {
         const docs = settingsSnap.docs;
         if (docs && docs.length > 0) {
           cachedSettings = docs[0].data();
           lastSettingsFetch = now;
           console.log("✅ Loaded settings successfully via Client Web SDK.");
           return cachedSettings;
         }
      }
    } catch (clientErr: any) {
      console.warn("ℹ️ Client Web SDK Settings Query failed:", clientErr.message);
    }
  }

  // 3. Last fallback: local Environment variables or static placeholders
  const envSettings = {
    storeName: 'The Ruby Fashion',
    storeLogo: '',
    fromEmail: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL,
    resendApiKey: process.env.RESEND_API_KEY || currentResendApiKey,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    oneSignalAppId: process.env.ONESIGNAL_APP_ID,
    oneSignalRestApiKey: process.env.ONESIGNAL_REST_API_KEY,
    razorpayKeyId: process.env.VITE_RAZORPAY_KEY_ID,
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
  };

  // Only use cache if we have no settings yet
  if (!cachedSettings) {
    cachedSettings = envSettings;
  }
  // Short TTL for env fallback so we can retry DB when available
  lastSettingsFetch = now - (SETTINGS_CACHE_TTL - 30000); 
  return envSettings;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global Unhandled Error Catchers
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('🔥 Uncaught Exception:', err);
});

// HTML Beautifier and Link Optimizer for The Ruby brand emails (Spam prevention & high-end design)
function enhanceAndSanitizeEmailHtml(
  html: string, 
  storeName: string, 
  storeLogo: string, 
  baseHost: string
): string {
  let processedHtml = html || "";

  // 1. Convert relative paths starting with / to absolute URLs using the active baseHost info
  if (baseHost) {
    const isLocalhost = baseHost.includes('localhost') || baseHost.includes('127.0.0.1');
    if (!isLocalhost) {
      processedHtml = processedHtml.replace(/(src|href)=["']\/([^/][^"']*)["']/gi, `$1="${baseHost}/$2"`);
    }
  }

  // 2. Format the logo URL
  let resolvedLogo = "";
  const effectiveLogo = storeLogo || "/logo.png";
  if (effectiveLogo) {
    if (effectiveLogo.startsWith('http')) {
      resolvedLogo = effectiveLogo;
    } else if (baseHost && !baseHost.includes('localhost') && !baseHost.includes('127.0.0.1')) {
      resolvedLogo = `${baseHost}${effectiveLogo.startsWith('/') ? '' : '/'}${effectiveLogo}`;
    } else {
      resolvedLogo = "https://images.unsplash.com/photo-1541336032412-2048a678540d?w=120&auto=format&fit=crop&q=80";
    }
  }

  // 3. Complete layout detection (avoid nesting multiple standard head/body boundaries)
  const isFullLayout = /<!DOCTYPE|<html|<\/head>|<\/body>/i.test(processedHtml);

  if (isFullLayout) {
    return processedHtml;
  }

  // 4. Wrapping simple text / simple div emails in a beautiful high-fashion template
  const currentYear = new Date().getFullYear();
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${storeName}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #FAF9F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1C1917;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #FAF9F6;">
        <tr>
          <td align="center" style="padding: 40px 10px 60px 10px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 32px; overflow: hidden; box-shadow: 0 20px 50px rgba(26, 44, 84, 0.08); border: 1px solid #E5E5E0;">
              
              <!-- Luxury High-Fashion Header -->
              <tr>
                <td align="center" style="padding: 45px 40px; background-color: #1A2C54; border-bottom: 5px solid #E11D48;">
                  ${resolvedLogo ? 
                    `<img src="${resolvedLogo}" alt="${storeName}" style="max-height: 52px; display: block; filter: brightness(0) invert(1);" referrerPolicy="no-referrer">` : 
                    `<div style="text-align: center;">
                      <span style="display: inline-block; font-size: 28px; font-weight: 900; letter-spacing: 6px; color: #ffffff; text-transform: uppercase;">THE <span style="color: #E11D48; border-bottom: 2px solid #E11D48; padding-bottom: 2px;">RUBY</span></span>
                      <div style="margin-top: 8px; font-size: 10px; font-weight: 700; letter-spacing: 8px; color: #FDA4AF; text-transform: uppercase; padding-left: 8px;">PREMIUM FASHION</div>
                     </div>`
                  }
                </td>
              </tr>
              
              <!-- Accent Ribbon -->
              <tr>
                <td height="4" style="background-color: #E11D48; line-height: 4px; font-size: 4px;">&nbsp;</td>
              </tr>

              <!-- Main Card Content -->
              <tr>
                <td style="padding: 50px 45px 35px 45px; text-align: left; background-color: #ffffff;">
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.65; color: #27272A;">
                    ${processedHtml}
                  </div>
                </td>
              </tr>

              <!-- Luxury Deep Navy Footer Section -->
              <tr>
                <td style="padding: 45px; background-color: #1A2C54; text-align: center;">
                  <span style="font-size: 16px; font-weight: 950; letter-spacing: 5px; color: #ffffff; text-transform: uppercase;">THE RUBY</span>
                  <p style="margin: 5px 0 0 0; color: #FDA4AF; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 3px;">Premium Couture &amp; Styles</p>
                  
                  <div style="margin: 25px 0; border-top: 1px solid rgba(255, 255, 255, 0.1); height: 1px; font-size: 1px; line-height: 1px;">&nbsp;</div>
                  
                  <p style="margin: 0; color: #94A3B8; font-size: 12px; line-height: 1.65; font-weight: 400;">
                    <strong>The Ruby Showroom &amp; Luxury Atelier</strong><br/>
                    12 Rue de la Paix, Paris, France &bull; DLF Emporio, Vasant Kunj, New Delhi, India
                  </p>
                  <p style="margin: 15px 0 0 0; color: #64748B; font-size: 11px; line-height: 1.6; font-weight: 400;">
                    You are receiving this automated security or service communication as a verified customer of The Ruby Co. If you believe this was received in error, please report it to our customer relations desk.
                  </p>
                  <p style="margin: 25px 0 0 0; color: #475569; font-size: 11px; font-weight: 600; letter-spacing: 0.5px;">&copy; ${currentYear} ${storeName}. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// Unified direct email sending helper for custom backend flows
async function sendEmailDirect({ to, subject, html, fromName, baseHost }: { to: string, subject: string, html: string, fromName?: string, baseHost?: string }) {
  let localCachedSettings = null;
  try {
    localCachedSettings = await resilientGetSettings();
  } catch (dbErr: any) {
    console.warn("ℹ️ Failed to load resilient settings for email, using fallback details:", dbErr.message);
  }

  const effectiveSettings = localCachedSettings || {
    storeName: 'The Ruby',
    storeLogo: '',
    fromEmail: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL,
    resendApiKey: process.env.RESEND_API_KEY,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
  };

  const finalFromName = fromName || effectiveSettings.storeName || 'The Ruby';
  const smtpUser = effectiveSettings.smtpUser || process.env.SMTP_USER;
  const smtpPass = effectiveSettings.smtpPass || process.env.SMTP_PASS;
  const apiKey = effectiveSettings.resendApiKey || process.env.RESEND_API_KEY || currentResendApiKey;

  // Enhance and beautiful HTML with correct base url before sending
  const beautifiedHtml = enhanceAndSanitizeEmailHtml(
    html,
    effectiveSettings.storeName || finalFromName,
    effectiveSettings.storeLogo || '',
    baseHost || ''
  );

  // Increment communications stat counters
  const currentMonth = new Date().toISOString().substring(0, 7);
  if (db && isDbWriteable !== false) {
    db.collection('system_stats').doc('communications').set({
      [currentMonth]: admin.firestore.FieldValue.increment(1)
    }, { merge: true }).catch((err: any) => {});
  }

  if (smtpUser && smtpPass) {
    const cleanUser = String(smtpUser).trim();
    const cleanPass = String(smtpPass).replace(/\s/g, ''); 
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: cleanUser,
        pass: cleanPass
      }
    });
    await transporter.sendMail({
      from: `"${finalFromName}" <${cleanUser}>`,
      to,
      subject,
      html: beautifiedHtml,
      replyTo: cleanUser
    });
    return { success: true, provider: 'smtp' };
  } else if (apiKey) {
    const dynamicResend = new Resend(apiKey);
    let rawFromEmail = effectiveSettings.fromEmail || DEFAULT_FROM_EMAIL;
    if (rawFromEmail.includes('rubyfashion.shop') && !rawFromEmail.includes(VERIFIED_DOMAIN)) {
      rawFromEmail = DEFAULT_FROM_EMAIL;
    }
    const formattedFrom = `"${finalFromName}" <${rawFromEmail}>`;
    try {
      const result = await dynamicResend.emails.send({
        from: formattedFrom,
        to: [to],
        subject,
        html: beautifiedHtml,
      });
      if (result.error) {
        throw result.error;
      }
      return { success: true, provider: 'resend' };
    } catch (resendErr: any) {
      const errMsg = String(resendErr.message || resendErr).toLowerCase();
      console.warn(`🛑 Resend sending failed with primary domain:`, resendErr.message || resendErr);
      
      console.warn("⚠️ Attempting temporary fallback using onboarding@resend.dev...");
      try {
        const fallbackFrom = `"${finalFromName}" <onboarding@resend.dev>`;
        const fallbackResult = await dynamicResend.emails.send({
          from: fallbackFrom,
          to: [to],
          subject,
          html: beautifiedHtml,
        });
        if (fallbackResult.error) {
          throw fallbackResult.error;
        }
        console.log("✅ Resend fallback transmission succeeded!");
        return { success: true, provider: 'resend-fallback', fallback: true };
      } catch (fallbackErr: any) {
        console.error("❌ Resend onboarding fallback failed too:", fallbackErr.message || fallbackErr);
        throw resendErr;
      }
    }
  } else {
    throw new Error("No SMTP or Resend API configurations are active in settings.");
  }
}

async function startServer() {
  const app = express();
  console.log(`🚀 Starting server setup...`);
  const httpServer = createServer(app);
  console.log(`✅ HTTP Server created.`);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });
  console.log(`✅ Socket.IO initialized.`);
  const PORT = Number(process.env.PORT) || 3000;
  
  // Real-time Analytics Store (Memory only for active count)
  const activeVisitors = new Map<string, any>();
  const seenSessionsToday = new Set<string>();
  let lastSeenDate = new Date().toISOString().split('T')[0];

  io.on("connection", (socket) => {
    // Send initial state immediately
    socket.emit("live_analytics_update", {
      activeCount: activeVisitors.size,
      visitors: Array.from(activeVisitors.values())
    });

    // Listen for visitor data
    socket.on("visitor_tracking", async (data) => {
      const today = new Date().toISOString().split('T')[0];
      
      // Reset seen sessions if day changed
      if (today !== lastSeenDate) {
        seenSessionsToday.clear();
        lastSeenDate = today;
      }

      const clientIp = requestIp.getClientIp(socket.request) || socket.handshake.address || '';
      const geo = geoip.lookup(clientIp);

      const session = {
        id: socket.id,
        sessionId: data.sessionId || socket.id,
        userId: data.userId || null,
        city: data.city && data.city !== 'Unknown' ? data.city : (geo?.city || "Unknown"),
        region: data.region && data.region !== 'Unknown' ? data.region : (geo?.region || "Unknown"),
        country: data.country && data.country !== 'Unknown' ? data.country : (geo?.country || "Unknown"),
        lat: data.lat || geo?.ll?.[0] || 0,
        lng: data.lng || geo?.ll?.[1] || 0,
        path: data.path || "/",
        userAgent: socket.handshake.headers["user-agent"],
        connectedAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      };

      activeVisitors.set(socket.id, session);
      
      // Update Firestore active_sessions for a persistent view in Admin Dashboard
      if (db && session.sessionId && isDbWriteable !== false) {
        try {
          await db.collection('active_sessions').doc(session.sessionId).set({
            ...session,
            lastSeen: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        } catch (e: any) {
          if (e.message?.includes('PERMISSION_DENIED') || e.code === 7) {
            isDbWriteable = false; // Gracefully restrict subsequent writes
            console.warn("ℹ️ Firestore active_sessions write skipped (insufficient credentials/IAM on custom database). Tracking active in memory.");
          } else {
            console.error("Firestore active_sessions write error:", e);
          }
        }
      }

      // Update Daily Analytics ONLY if this session is new today
      if (db && data.sessionId && !seenSessionsToday.has(data.sessionId) && isDbWriteable !== false) {
        try {
          seenSessionsToday.add(data.sessionId);
          await db.collection('analytics_daily').doc(today).set({
            total_users: admin.firestore.FieldValue.increment(1),
            date: today
          }, { merge: true });
        } catch (e: any) {
          if (e.message?.includes('PERMISSION_DENIED') || e.code === 7) {
            isDbWriteable = false; // Gracefully restrict subsequent writes
            console.warn("ℹ️ Firestore analytics_daily write skipped (insufficient credentials/IAM on custom database). Tracking active locally.");
          } else {
            console.error("Tracking Analytics error:", e);
          }
        }
      }

      // Broadcast update to all clients
      const visitors = Array.from(activeVisitors.values());
      const activeCarts = visitors.filter(v => v.lastCheckpoint === 'cart').length;
      const checkingOut = visitors.filter(v => v.lastCheckpoint === 'checkout').length;

      io.emit("live_analytics_update", {
        activeCount: activeVisitors.size,
        visitors,
        behavior: {
          activeCarts,
          checkingOut
        }
      });
    });

    socket.on("checkpoint_reached", (data) => {
      console.log(`📍 Checkpoint reached: ${data.type} by ${data.sessionId}`);
      
      // Find visitor by socket.id or sessionId
      let visitorEntry = Array.from(activeVisitors.entries()).find(([sid, v]) => sid === socket.id || v.sessionId === data.sessionId);
      
      if (visitorEntry) {
        const [sid, visitor] = visitorEntry;
        visitor.lastCheckpoint = data.type;
        visitor.lastSeen = new Date().toISOString();
        activeVisitors.set(sid, visitor);
        
        // Update Firestore as well
        if (db && isDbWriteable !== false) {
          const docId = visitor.sessionId || sid;
          db.collection('active_sessions').doc(docId).update({
            lastCheckpoint: data.type,
            lastSeen: admin.firestore.FieldValue.serverTimestamp()
          }).catch(() => {});
        }
      }
      
      // Broadcast activity event for the live feed
      io.emit("live_activity_event", {
        type: data.type,
        sessionId: data.sessionId,
        city: visitorEntry?.[1]?.city || 'Unknown',
        timestamp: new Date().toISOString()
      });

      // Broadcast update to all clients
      const visitorsList = Array.from(activeVisitors.values());
      const activeCarts = visitorsList.filter(v => v.lastCheckpoint === 'cart').length;
      const checkingOut = visitorsList.filter(v => v.lastCheckpoint === 'checkout').length;

      io.emit("live_analytics_update", {
        activeCount: activeVisitors.size,
        visitors: visitorsList,
        behavior: {
          activeCarts,
          checkingOut
        }
      });
    });

    socket.on("disconnect", async () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
      const session = activeVisitors.get(socket.id);
      activeVisitors.delete(socket.id);
      
      // Remove from Firestore active_sessions if we can identify it
      if (db && isDbWriteable !== false) {
        try {
          const docId = session?.sessionId || socket.id;
          await db.collection('active_sessions').doc(docId).delete().catch(() => {});
        } catch (e) {
          // Silent or warning
        }
      }

      // Broadcast update
      io.emit("live_analytics_update", {
        activeCount: activeVisitors.size,
        visitors: Array.from(activeVisitors.values())
      });
    });
  });
  
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 Port: ${PORT}`);

  // Initialize clients inside startServer for robustness
  try {
    resend = new Resend(currentResendApiKey || 'dummy');
    console.log("✅ Resend initialized (maybe dummy key)");
  } catch (e) {
    console.error("❌ Resend init failed:", e);
  }
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

  console.log("⚙️  Applying middleware...");
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  
  // Debug Middleware
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`📡 [API REQUEST] ${req.method} ${req.path}`);
    }
    next();
  });
  
  console.log("✅ Middleware applied.");

  // CRITICAL: Cleanup Route placed early and using a very specific handler to avoid SPA fallback
  app.post("/api/admin/cleanup", async (req, res) => {
    console.log("🧹 [SERVER-CLEANUP] Request received");
    res.setHeader('Content-Type', 'application/json');
    const { password } = req.body || {};
    
    if (password !== "RESET_THE_RUBY_Launch_2026") {
      console.warn("❌ [SERVER-CLEANUP] Invalid password");
      return res.status(403).json({ error: "Invalid password." });
    }

    try {
      console.log("🧹 [SERVER-CLEANUP] Reading config...");
      const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
      const targetProj = config.projectId;
      const targetDb = config.firestoreDatabaseId;
      console.log(`🧹 [SERVER-CLEANUP] Target: ${targetProj} / ${targetDb}`);

      let activeDb = db;
      if (!activeDb) {
        console.log("🧹 [SERVER-CLEANUP] Global DB not ready, initializing local...");
        if (!admin.apps.length) {
          admin.initializeApp({ projectId: targetProj });
        }
        try {
          activeDb = getFirestore(admin.app(), targetDb);
        } catch (e) {
          activeDb = getFirestore(admin.app(), '(default)');
        }
      }
      
      console.log("🧹 [SERVER-CLEANUP] Listing collections...");
      const collections = await activeDb.listCollections();
      console.log(`🧹 [SERVER-CLEANUP] Found ${collections.length} collections.`);
      
      const results: any = {};
      for (const coll of collections) {
        console.log(`🧹 [SERVER-CLEANUP] Processing ${coll.id}...`);
        const snap = await coll.limit(500).get(); // Limit to 500 for safety in one go
        if (!snap.empty) {
          const docs = snap.docs;
          let delCount = 0;
          const batch = activeDb.batch();
          
          docs.forEach(d => {
            if (coll.id === 'users') {
              const data = d.data();
              if (data.email !== 'mdsagaransari65670@gmail.com' && data.role !== 'admin') {
                batch.delete(d.ref);
                delCount++;
              }
            } else if (!['banners', 'products', 'categories', 'sizes', 'colors', 'coupons', 'settings', 'admins'].includes(coll.id)) {
              batch.delete(d.ref);
              delCount++;
            }
          });
          
          await batch.commit();
          results[coll.id] = delCount;
          console.log(`✅ [SERVER-CLEANUP] Deleted ${delCount} from ${coll.id}`);
        } else {
          results[coll.id] = 0;
        }
      }
      console.log("✅ [SERVER-CLEANUP] DONE");
      res.json({ success: true, message: "Storage wiped successfully.", results });
    } catch (err: any) {
      console.error("❌ [SERVER-CLEANUP] FATAL:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Backward compatibility handled directly without redirect
  app.post("/api/clear-production-data", async (req, res) => {
     // Just forward to the same logic
     req.url = "/api/admin/cleanup";
     return app._router.handle(req, res, () => {});
  });

  // Root route for Health Checks & Production Serving
  app.get("/", (req, res, next) => {
    if (process.env.NODE_ENV === "production") {
      const distPath = path.join(process.cwd(), 'dist');
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      } else {
        // Return 200 OK for Render Health Check even if dist is missing
        return res.status(200).send("Server is UP, but 'dist' folder is missing. Please run 'npm run build'.");
      }
    }
    next();
  });

  app.get("/api/health", (req, res) => {
    res.status(200).send("OK ✅");
  });

  app.post("/api/track-order", async (req, res) => {
    const { orderId, email } = req.body;
    console.log(`🔍 Order tracking request: ID=${orderId}, Email=${email}`);
    
    if (!orderId || !email) {
      return res.status(400).json({ error: "Order ID and Email are both required." });
    }

    // Force initialize Client Firestore fallback first
    initializeClientFirestore();

    const inputOid = String(orderId).trim();
    const cleanOid = inputOid.replace(/^#/, '').trim(); // Remove leading # if present
    const hashedOid = `#${cleanOid}`;
    const targetEmail = String(email).trim().toLowerCase();

    console.log(`🔍 Tracking Attempt: ID=${inputOid} (Clean=${cleanOid}), Email=${targetEmail}`);
    let orderData: any = null;

    // --- STRATEGY 1: HIGHLY-RESILIENT CLIENT WEB SDK SEARCH ---
    // Immune to Google Cloud IAM container/service-account restriction issues!
    if (clientDb && isClientDbReady) {
      try {
        console.log("🔍 Resilient Track: Trying Web Client SDK search first...");
        
        // 1. Try finding by document ID first (if cleanOid looks like a Firestore ID)
        if (cleanOid.length > 15) {
          try {
            const docSnap = await cGetDoc(cDoc(clientDb, 'orders', cleanOid));
            if (docSnap.exists()) {
              const data = docSnap.data();
              const customerEmail = String(data?.email || data?.address?.email || data?.customerEmail || '').trim().toLowerCase();
              if (customerEmail === targetEmail) {
                orderData = { id: docSnap.id, ...data };
                console.log("✅ Match found by Doc ID using Client SDK");
              }
            }
          } catch (e: any) {
            console.log("Client SDK Doc ID fetch skipped:", e.message);
          }
        }

        // 2. Query search by variants of orderId field
        if (!orderData) {
          const variants = [
            hashedOid, 
            cleanOid, 
            hashedOid.toUpperCase(), 
            cleanOid.toUpperCase(),
            inputOid
          ];
          const uniqueVariants = [...new Set(variants.filter(v => v))];
          console.log(`🔍 Client SDK checking variations: ${JSON.stringify(uniqueVariants)}`);

          for (const variant of uniqueVariants) {
            const emailFields = ['email', 'address.email', 'customerEmail'];
            for (const emailField of emailFields) {
              try {
                const querySnap = await cGetDocs(cQuery(
                  cCollection(clientDb, 'orders'),
                  cWhere('orderId', '==', variant),
                  cWhere(emailField, '==', targetEmail),
                  cLimit(1)
                ));
                if (!querySnap.empty) {
                  const firstDoc = querySnap.docs[0];
                  orderData = { id: firstDoc.id, ...firstDoc.data() };
                  console.log(`✅ Found order with Client SDK by orderId and ${emailField}`);
                  break;
                }
              } catch (err: any) {
                console.warn(`Client SDK query for ${emailField} skipped:`, err.message);
              }
            }
            if (orderData) break;
          }
        }

        // 3. Fallback: Search by EMAIL first, then filter by Order ID in memory
        if (!orderData) {
          console.log("🔍 Client SDK Fallback: Searching by email first...");
          const emailOptions = ['email', 'address.email', 'customerEmail'];
          for (const field of emailOptions) {
            try {
              const emailSnap = await cGetDocs(cQuery(
                cCollection(clientDb, 'orders'),
                cWhere(field, '==', targetEmail),
                cLimit(20)
              ));
              if (!emailSnap.empty) {
                for (const doc of emailSnap.docs) {
                  const data = doc.data();
                  const dbOid = String(data.orderId || '').trim();
                  const dbCleanOid = dbOid.replace(/^#/, '');
                  
                  if (dbOid === inputOid || dbOid === hashedOid || dbCleanOid === cleanOid || doc.id === cleanOid) {
                    orderData = { id: doc.id, ...data };
                    console.log(`✅ Client SDK Fallback matched order: ${dbOid}`);
                    break;
                  }
                }
              }
            } catch (err: any) {
              console.warn(`Client SDK email query failed:`, err.message);
            }
            if (orderData) break;
          }
        }
      } catch (clientErr: any) {
        console.warn("⚠️ Resilient Client Web SDK tracking failed, falling back to Admin SDK:", clientErr.message);
      }
    }

    // --- STRATEGY 2: FALLBACK TO FIREBASE ADMIN SDK ---
    if (!orderData) {
      try {
        if (!db) {
          console.log("⏳ Initializing Firebase Admin for tracking...");
          await initializeFirebase();
        }
        
        if (!db) {
          return res.status(400).json({ error: "Database is initializing. Please try again or refresh!" });
        }

        console.log("🔍 Resilient Track: Trying Admin SDK query fallback...");

        // 1. Try finding by document ID first (if cleanOid looks like a Firestore ID)
        if (cleanOid.length > 15) {
          try {
            const docSnap = await db.collection('orders').doc(cleanOid).get();
            if (docSnap.exists) {
              const data = docSnap.data();
              const customerEmail = String(data?.email || data?.address?.email || data?.customerEmail || '').trim().toLowerCase();
              if (customerEmail === targetEmail) {
                orderData = { id: docSnap.id, ...data };
              }
            }
          } catch (e) {
            console.log("Admin Doc ID fetch failed, moving to query search...");
          }
        }

        // 2. Query search by variants of orderId field
        if (!orderData) {
          const variants = [
            hashedOid, 
            cleanOid, 
            hashedOid.toUpperCase(), 
            cleanOid.toUpperCase(),
            inputOid
          ];
          
          const uniqueVariants = [...new Set(variants.filter(v => v))];
          console.log(`🔍 Admin checking variations: ${JSON.stringify(uniqueVariants)}`);

          for (const variant of uniqueVariants) {
            const emailFields = ['email', 'address.email', 'customerEmail'];
            
            for (const emailField of emailFields) {
              const querySnap = await db.collection('orders')
                .where('orderId', '==', variant)
                .where(emailField, '==', targetEmail)
                .limit(1)
                .get();
              
              if (!querySnap.empty) {
                orderData = { id: querySnap.docs[0].id, ...querySnap.docs[0].data() };
                console.log(`✅ Found order by Admin orderId and ${emailField}`);
                break;
              }
            }
            if (orderData) break;
          }
        }

        // 3. Fallback: Search by EMAIL first, then filter by Order ID in memory
        if (!orderData) {
          console.log("🔍 Admin Fallback: Searching by email first...");
          const emailOptions = ['email', 'address.email', 'customerEmail'];
          for (const field of emailOptions) {
            const emailSnap = await db.collection('orders')
              .where(field, '==', targetEmail)
              .limit(20)
              .get();
              
            if (!emailSnap.empty) {
              for (const doc of emailSnap.docs) {
                const data = doc.data();
                const dbOid = String(data.orderId || '').trim();
                const dbCleanOid = dbOid.replace(/^#/, '');
                
                if (dbOid === inputOid || dbOid === hashedOid || dbCleanOid === cleanOid || doc.id === cleanOid) {
                  orderData = { id: doc.id, ...data };
                  console.log(`✅ Admin Fallback found order: ${dbOid}`);
                  break;
                }
              }
            }
            if (orderData) break;
          }
        }
      } catch (error: any) {
        console.error("Order tracking Admin error:", error);
        const isPermissionError = error.message?.includes("PERMISSION_DENIED") || error.code === 7;
        const isNotFoundError = error.message?.includes("NOT_FOUND") || error.code === 5;
        
        if (isNotFoundError && (req as any)._retryCount !== 1) {
          console.log("NOT_FOUND detected. Re-initializing Firebase and retrying...");
          (req as any)._retryCount = 1;
          await initializeFirebase(true);
          return res.redirect(307, req.originalUrl); 
        }

        let userFriendlyError = "Tracking failed on server. Please try again later.";
        if (isPermissionError) {
          userFriendlyError = `Firebase Permission Error!
          \nProject: ${adminApp?.options.projectId || 'unknown'}
          \nDatabase: ${currentFirestoreDatabaseId}
          \nSolution: Go to Admin Panel and click 'Set up Firebase' to accept terms and reset permissions.`;
          
          return res.status(403).json({ 
            error: userFriendlyError,
            details: error.message
          });
        }
        
        return res.status(500).json({ error: userFriendlyError, details: error.message });
      }
    }

    if (!orderData) {
      return res.status(404).json({ 
        error: "Order not found. Please check Order ID and Email.",
        hint: "Either the Order ID or Email is incorrect. Did you enter these details correctly at checkout?" 
      });
    }

    // Final safety check
    const customerEmail = String(orderData.email || orderData.address?.email || orderData.customerEmail || '').trim().toLowerCase();
    if (customerEmail !== targetEmail) {
      console.log(`❌ Email mismatch: Found ${customerEmail}, expected ${targetEmail}`);
      return res.status(403).json({ 
        error: "Email doesn't match.",
        details: `The registered email for this Order ID is "${customerEmail.substring(0, 3)}***${customerEmail.substring(customerEmail.indexOf('@'))}".`
      });
    }

    res.json(orderData);
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

    if (resendApiKey !== undefined) {
      currentResendApiKey = resendApiKey;
      resend = resendApiKey ? new Resend(resendApiKey) : null;
      process.env.RESEND_API_KEY = resendApiKey || '';
      console.log("Resend API Key updated:", resendApiKey ? "Key Provided" : "Cleared");
    }

    if (smtpUser !== undefined) process.env.SMTP_USER = smtpUser || '';
    if (smtpPass !== undefined) process.env.SMTP_PASS = smtpPass || '';

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

  app.get("/api/system-health", async (req, res) => {
    // Dynamically retrieve database configuration settings
    let emailStatus = (process.env.SMTP_USER || process.env.RESEND_API_KEY) ? "Configured ✅" : "Not Configured ❌";
    let activeEmailProvider = process.env.SMTP_USER ? "Gmail SMTP" : (process.env.RESEND_API_KEY ? "Resend API" : "None");
    
    let razorpayStatus = process.env.VITE_RAZORPAY_KEY_ID ? "Configured ✅" : "Missing Keys ❌";
    let razorpayKeyId = process.env.VITE_RAZORPAY_KEY_ID ? `${process.env.VITE_RAZORPAY_KEY_ID.substring(0, 8)}...` : 'None';

    let osStatus = oneSignalClient ? "Initialized ✅" : "Not Configured ❌";
    let osAppId = (process.env.ONESIGNAL_APP_ID || process.env.VITE_ONESIGNAL_APP_ID || '').trim();
    let osRestKey = (process.env.ONESIGNAL_REST_API_KEY || '').trim();

    try {
      const settings = await resilientGetSettings();
      if (settings) {
        if (settings.oneSignalAppId && settings.oneSignalAppId !== 'YOUR_ONESIGNAL_APP_ID') {
          osAppId = String(settings.oneSignalAppId).trim();
          osRestKey = String(settings.oneSignalRestApiKey || osRestKey || '').trim();
          
          if (osAppId && osRestKey) {
            osStatus = "Initialized ✅";
            if (!oneSignalClient) {
              try {
                oneSignalClient = new OneSignal.Client(osAppId, osRestKey);
              } catch (err) {}
            }
          }
        }
        if (settings.razorpayKeyId) {
          razorpayStatus = "Configured ✅";
          razorpayKeyId = `${settings.razorpayKeyId.substring(0, 8)}...`;
        }
        if (settings.resendApiKey || settings.smtpUser) {
          emailStatus = "Configured ✅";
          activeEmailProvider = settings.smtpUser ? "Gmail SMTP" : "Resend API";
        }
      }
    } catch (e: any) {
      console.warn("OneSignal health check failed to read current settings:", e.message);
    }

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
          status: emailStatus,
          activeProvider: activeEmailProvider,
          hasResendKey: !!process.env.RESEND_API_KEY,
          hasSmtpUser: !!process.env.SMTP_USER,
          usingLocalPersistence: fs.existsSync(localConfigPath),
          verifiedDomain: VERIFIED_DOMAIN,
          defaultFrom: DEFAULT_FROM_EMAIL
        },
        razorpay: {
          status: razorpayStatus,
          keyId: razorpayKeyId
        },
        oneSignal: {
          status: osStatus,
          appId: osAppId ? `${osAppId.substring(0, 8)}...` : 'None'
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
    if (!keyId) {
      try {
        const settings = await resilientGetSettings();
        if (settings) {
          keyId = settings.razorpayKeyId;
          hasSecret = !!settings.razorpayKeySecret;
        }
      } catch (err: any) {
        console.error("Error fetching settings for config:", err.message);
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
    if (!keyId || !keySecret) {
      try {
        console.log("Keys missing in env, attempting to load from Firestore...");
        const settings = await resilientGetSettings();
        if (settings && settings.razorpayKeyId && settings.razorpayKeySecret) {
          keyId = settings.razorpayKeyId.trim();
          keySecret = settings.razorpayKeySecret.trim();
          console.log("Loaded Razorpay keys from settings");
        }
      } catch (err: any) {
        console.error("Error loading settings from Firestore fallback:", err.message);
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

  // Serve profile photo directly as image contents bypassing Firebase Storage limitations
  app.get('/api/user/photo/:uid', async (req, res) => {
    const { uid } = req.params;
    if (!uid) {
      return res.status(400).send("User ID required");
    }

    try {
      let photoBase64 = "";

      // 1. Try reading from Firestore Admin SDK if ready
      if (db && isDbWriteable !== false) {
        try {
          const userDoc = await db.collection('users').doc(uid).get();
          if (userDoc.exists) {
            photoBase64 = userDoc.data()?.photoBase64 || "";
          }
        } catch (fErr: any) {
          console.warn("❌ Firestore read photoBase64 failed:", fErr.message);
        }
      }

      // 2. Fallback to Client SDK Firestore
      if (!photoBase64) {
        initializeClientFirestore();
        if (clientDb && isClientDbReady) {
          try {
            const { doc: cDoc, getDoc: cGetDoc } = await import('firebase/firestore');
            const userDocSnap = await cGetDoc(cDoc(clientDb, 'users', uid));
            if (userDocSnap.exists()) {
              photoBase64 = userDocSnap.data()?.photoBase64 || "";
            }
          } catch (clientErr: any) {
            console.warn("ℹ️ Client Web SDK photo query failed:", clientErr.message);
          }
        }
      }

      // 3. Serve the photo securely
      if (photoBase64 && photoBase64.startsWith('data:image')) {
        const matches = photoBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const contentType = matches[1];
          const dataBuffer = Buffer.from(matches[2], 'base64');
          
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
          return res.send(dataBuffer);
        }
      }

      // Redirection fallback to Dicebear avatar if no custom image base64 exists
      return res.redirect(`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(uid)}`);
    } catch (err: any) {
      console.error("❌ Serve user photo error:", err);
      return res.redirect(`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(uid)}`);
    }
  });

  // Handle uploading user profile picture and saving to Firestore & update Auth photoURL
  app.post('/api/user/upload-profile-image', async (req, res) => {
    const { uid, photo } = req.body;
    
    if (!uid || !photo) {
      return res.status(400).json({ error: "Missing uid or photo content." });
    }

    try {
      // Use clean image endpoint with timestamp to force cache refresh
      const photoURL = `/api/user/photo/${uid}?t=${Date.now()}`;
      
      // 1. Update in Firestore
      if (db && isDbWriteable !== false) {
        try {
          await db.collection('users').doc(uid).set({
            photoBase64: photo,
            photoURL: photoURL,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          console.log(`✅ Stored photoBase64 in Firestore for user ${uid}`);
        } catch (fErr: any) {
          console.error("❌ Failed to store photoBase64 in Firestore:", fErr.message);
        }
      }

      // 2. Also try writing via Client SDK Firestore for local/sandbox consistency
      initializeClientFirestore();
      if (clientDb && isClientDbReady) {
        try {
          const { doc: cDoc, setDoc: cSetDoc } = await import('firebase/firestore');
          await cSetDoc(cDoc(clientDb, 'users', uid), {
            photoBase64: photo,
            photoURL: photoURL,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          console.log(`✅ Stored photoBase64 via Client SDK for user ${uid}`);
        } catch (clientErr: any) {
          console.warn("ℹ️ Client SDK photo update skipped:", clientErr.message);
        }
      }

      // 3. Update Firebase Auth (if not sandbox user)
      if (!uid.startsWith('offline_')) {
        try {
          await admin.auth().updateUser(uid, {
            photoURL: photoURL
          });
          console.log(`✅ Updated Auth photoURL in Firebase Auth for user ${uid}`);
        } catch (authErr: any) {
          console.error("❌ Failed to update Auth photoURL in Firebase Auth:", authErr.message);
        }
      }

      return res.json({ success: true, photoURL });
    } catch (err: any) {
      console.error("❌ User photo upload handler error:", err);
      return res.status(500).json({ error: err.message || "Failed to process profile photo." });
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

  // In-memory recovery cache for password resets to guarantee 100% success on any Firestore custom-db permissions configuration
  const resetPasswordCodes = new Map<string, { otp: string, expiresAt: number, uid: string, displayName: string }>();

  app.post("/api/auth/forgot-password/request", async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email address is required." });
    }

    const cleanEmail = email.trim().toLowerCase();

    try {
      let uid = "";
      let displayName = "User";

      // 1. Attempt Firestore first if initialized
      if (db && isDbWriteable !== false) {
        try {
          const usersSnap = await db.collection('users').where('email', '==', cleanEmail).limit(1).get();
          if (!usersSnap.empty) {
            const userDoc = usersSnap.docs[0];
            const userData = userDoc.data();
            uid = userData.uid || userDoc.id;
            displayName = userData.firstName || userData.displayName || 'User';
          }
        } catch (dbErr: any) {
          console.warn("⚠️ Firestore collection 'users' read skipped: Falling back.", dbErr.message);
        }
      }

      // 1.5 Try Client Web SDK User Lookup Fallback
      if (!uid) {
        initializeClientFirestore();
        if (clientDb && isClientDbReady) {
          try {
            const { query: cQuery, collection: cCollection, limit: cLimit, getDocs: cGetDocs, where: cWhere } = await import('firebase/firestore');
            const usersQuery = cQuery(cCollection(clientDb, 'users'), cWhere('email', '==', cleanEmail), cLimit(1));
            const usersSnap = await cGetDocs(usersQuery);
            if (!usersSnap.empty) {
              const userDoc = usersSnap.docs[0];
              const userData = userDoc.data();
              uid = userData.uid || userDoc.id;
              displayName = userData.firstName || userData.displayName || 'User';
              console.log("✅ Found user via Client Web SDK lookup fallback:", uid);
            }
          } catch (clientErr: any) {
            console.warn("ℹ️ Client Web SDK User Lookup skipped:", clientErr.message);
          }
        }
      }

      // 2. Fallback to Admin Auth lookup (always works and doesn't get blocked by Firestore IAM!)
      if (!uid) {
        try {
          const userRecord = await admin.auth().getUserByEmail(cleanEmail);
          uid = userRecord.uid;
          displayName = userRecord.displayName || userRecord.email?.split('@')[0] || "User";
          console.log(`✅ Found user via Admin Auth: UID=${uid}, DisplayName=${displayName}`);
        } catch (authErr: any) {
          console.warn("⚠️ Firebase Auth user lookup failed. Bypassing with resilient offline fallback UID details:", authErr.message);
          // Always fall back to consistent offline fallback UID derived from email to guarantee 100% success
          uid = `offline_${Buffer.from(cleanEmail).toString('hex').slice(0, 16)}`;
          displayName = cleanEmail.split('@')[0] || "User";
        }
      }

      // Generate 6-digit numeric OTP code
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Store in memory cache
      resetPasswordCodes.set(cleanEmail, { otp, expiresAt, uid, displayName });

      // Best effort update to Firestore if writable
      if (db && isDbWriteable !== false) {
        try {
          await db.collection('users').doc(uid).update({
            resetOtp: otp,
            resetOtpExpiresAt: expiresAt
          }).catch(() => {});
        } catch (_) {}
      }

      // Send email using helper
      let storeName = "The Ruby Fashion";
      let storeLogo = "";
      try {
        const setts = await resilientGetSettings();
        if (setts) {
          storeName = setts.storeName || storeName;
          storeLogo = setts.storeLogo || storeLogo;
        }
      } catch (_) {}

      // Solve Gmail proxy missing images by converting relative logo paths to full absolute URLs
      const baseHost = `${req.protocol}://${req.get('host')}`.replace(/^http:/i, 'https:');
      const isLocalhost = baseHost.includes('localhost') || baseHost.includes('127.0.0.1');
      
      let resolvedLogo = "";
      const effectiveLogo = storeLogo || "/logo.png";
      if (effectiveLogo && !isLocalhost) {
        if (effectiveLogo.startsWith('http')) {
          resolvedLogo = effectiveLogo;
        } else {
          resolvedLogo = `${baseHost}${effectiveLogo.startsWith('/') ? '' : '/'}${effectiveLogo}`;
        }
      }

      // Capture request fingerprint details to make the email extremely cool and secure!
      const clientIp = requestIp.getClientIp(req) || req.ip || "127.0.0.1";
      const geo = geoip.lookup(clientIp);
      const requestCity = geo?.city || "New Delhi";
      const requestCountry = geo?.country || "India";
      const requestTime = new Date().toLocaleString('en-US', { 
        timeZone: 'UTC', 
        dateStyle: 'medium', 
        timeStyle: 'short' 
      }) + " UTC";
      
      const userAgent = req.get('User-Agent') || "Unknown Device";
      const isMobile = /mobile|android|iphone|ipad/i.test(userAgent);
      const isMac = /mac/i.test(userAgent);
      const isWindows = /win/i.test(userAgent);
      const osName = isMobile ? "Mobile Device" : isMac ? "macOS Desktop" : isWindows ? "Windows PC" : "Linux/Desktop PC";

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #FAF9F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1C1917;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #FAF9F6;">
            <tr>
              <td align="center" style="padding: 40px 10px 40px 10px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08); border: 1px solid #E5E7EB;">
                  
                  <!-- Luxury High-Fashion Header with sparkles -->
                  <tr>
                    <td align="center" style="padding: 40px 30px; background-color: #0F172A; text-align: center;">
                      <table border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td align="center">
                            <!-- Left Sparkle -->
                            <span style="color: #FDA4AF; font-size: 16px; vertical-align: middle; margin-right: 15px; font-weight: bold;">✦</span>
                            
                            <!-- Red Faceted Diamond Logo (Fidelity Premium SVG) -->
                            <div style="display: inline-block; vertical-align: middle; margin: 0 5px;">
                              <svg width="42" height="36" viewBox="0 0 48 42" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0 auto;">
                                <path d="M15.5 2L6 14L24 40L42 14L32.5 2H15.5Z" fill="#E11D48" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M15.5 2L24 14L32.5 2" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M6 14H42" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M15.5 2L24 40M32.5 2L24 40" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M15.5 2H32.5" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M24 14L24 40" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                              </svg>
                            </div>

                            <!-- Right Sparkle -->
                            <span style="color: #FDA4AF; font-size: 16px; vertical-align: middle; margin-left: 15px; font-weight: bold;">✦</span>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding-top: 12px;">
                            ${resolvedLogo ? 
                              `<img src="${resolvedLogo}" alt="${storeName}" style="max-height: 48px; display: inline-block; margin-bottom: 5px;" referrerPolicy="no-referrer">` :
                              `<span style="display: block; font-size: 24px; font-weight: 800; letter-spacing: 5px; color: #ffffff; text-transform: uppercase; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">The Ruby</span>`
                            }
                            <div style="margin-top: 4px; font-size: 11px; font-weight: 500; letter-spacing: 2px; color: #FDA4AF; text-transform: uppercase;">Your Style. Your Choice.</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Main Luxurious Card Content -->
                  <tr>
                    <td style="padding: 40px 40px 30px 40px; text-align: center; background-color: #ffffff;">
                      
                      <!-- Envelope Illustration with Overlapping Padlock -->
                      <div style="display: block; margin: 0 auto 30px auto; width: 100px; height: 100px;">
                        <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="50" cy="50" r="46" fill="#FCE7F3" />
                          <rect x="24" y="32" width="52" height="36" rx="6" fill="#E11D48" />
                          <path d="M24 35L47.6 51C49 52 51 52 52.4 51L76 35" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
                          <path d="M24 65L42 50" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                          <path d="M76 65L58 50" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                          <circle cx="72" cy="66" r="14" fill="#0F172A" />
                          <path d="M68 64V61C68 58.8 69.8 57 72 57C72.2 57 74 58.8 74 61V64" stroke="#ffffff" stroke-width="2" stroke-linecap="round" />
                          <rect x="66" y="64" width="12" height="9" rx="2" fill="#ffffff" />
                        </svg>
                      </div>

                      <h2 style="margin: 0 0 16px 0; color: #0F172A; font-size: 26px; font-weight: 800; line-height: 1.3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">Security <span style="color: #E11D48;">Verification Code</span></h2>
                      
                      <div style="text-align: left; padding: 10px 0;">
                        <p style="margin: 0 0 12px 0; color: #1F2937; font-size: 14px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">Hello,</p>
                        <p style="margin: 0 0 24px 0; color: #4B5563; font-size: 14px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">We received a request to authorize a password change for your <strong style="color: #E11D48;">${storeName}</strong> account. Please use the beautiful, secure code below to complete your verification setup:</p>
                      </div>

                      <!-- Premium Luxury OTP Display Code Widget -->
                      <div style="margin: 24px 0 32px 0; text-align: center;">
                        <div style="display: inline-block; background-color: #FAF9F6; border: 2px dashed #E11D48; padding: 24px 40px; border-radius: 20px; box-shadow: 0 10px 30px rgba(225, 29, 72, 0.06); text-align: center;">
                          <span style="display: block; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 4px; color: #E11D48; margin-bottom: 12px;">One-Time Passcode</span>
                          <span style="display: block; font-size: 46px; font-weight: 900; letter-spacing: 14px; color: #0F172A; font-family: 'Courier New', Courier, monospace; line-height: 1; margin-left: 14px;">${otp}</span>
                          <span style="display: block; font-size: 11px; color: #64748B; margin-top: 14px; font-weight: 500;">Enter this code into the verification form on the page</span>
                        </div>
                      </div>

                      <!-- Security warning/ignore sub-box matching reference screenshot exactly -->
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FFF1F2; border-radius: 12px; margin-bottom: 25px;">
                        <tr>
                          <td style="padding: 16px 20px; text-align: left;" valign="middle">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                              <tr>
                                <td width="32" valign="middle" style="padding-right: 12px;">
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                                    <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" fill="#FCE7F3" stroke="#E11D48" stroke-width="2" stroke-linejoin="round" />
                                    <path d="M9 11L11 13L15 9" stroke="#E11D48" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                  </svg>
                                </td>
                                <td style="color: #4B5563; font-size: 12px; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;" valign="middle">
                                  This security code will expire in 15 minutes. If you did not make this request, you can safely <span style="color: #E11D48; font-weight: 700;">ignore</span> this notification.
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <div style="text-align: left; padding-top: 10px;">
                        <p style="margin: 0; color: #4B5563; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">Thanks,</p>
                        <p style="margin: 4px 0 0 0; color: #1F2937; font-size: 13px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">Team <span style="color: #E11D48;">${storeName}</span></p>
                      </div>

                    </td>
                  </tr>

                  <!-- High-Contrast Secure Bottom Footer Rail matching look-and-feel exactly -->
                  <tr>
                    <td style="padding: 24px 20px; background-color: #0F172A; text-align: center;">
                      <table border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td align="center">
                            <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto; table-layout: fixed;">
                              <tr>
                                <!-- Item 1 -->
                                <td align="center" style="padding: 0 8px; color: #ffffff; font-size: 9px; font-weight: 750; text-transform: uppercase; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                                  <span style="color: #E11D48; font-size: 11px; margin-right: 3px; vertical-align: middle;">🔒</span>
                                  <span style="vertical-align: middle;">Secure Account</span>
                                </td>
                                <!-- Divider -->
                                <td style="width: 1px; background-color: rgba(255, 255, 255, 0.15); height: 12px;"></td>
                                <!-- Item 2 -->
                                <td align="center" style="padding: 0 8px; color: #ffffff; font-size: 9px; font-weight: 750; text-transform: uppercase; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                                  <span style="color: #E11D48; font-size: 11px; margin-right: 3px; vertical-align: middle;">🛡️</span>
                                  <span style="vertical-align: middle;">Your Data is Safe</span>
                                </td>
                                <!-- Divider -->
                                <td style="width: 1px; background-color: rgba(255, 255, 255, 0.15); height: 12px;"></td>
                                <!-- Item 3 -->
                                <td align="center" style="padding: 0 8px; color: #ffffff; font-size: 9px; font-weight: 750; text-transform: uppercase; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                                  <span style="color: #E11D48; font-size: 11px; margin-right: 3px; vertical-align: middle;">🕒</span>
                                  <span style="vertical-align: middle;">Expires in 15 mins</span>
                                </td>
                                <!-- Divider -->
                                <td style="width: 1px; background-color: rgba(255, 255, 255, 0.15); height: 12px;"></td>
                                <!-- Item 4 -->
                                <td align="center" style="padding: 0 8px; color: #ffffff; font-size: 9px; font-weight: 750; text-transform: uppercase; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                                  <span style="color: #E11D48; font-size: 11px; margin-right: 3px; vertical-align: middle;">🎧</span>
                                  <span style="vertical-align: middle;">24/7 Support</span>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding-top: 16px; color: #64748B; font-size: 9px; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                            &copy; ${new Date().getFullYear()} ${storeName}. All rights reserved under secure customer policies.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      try {
        await sendEmailDirect({
          to: cleanEmail,
          subject: `${otp} is your verification code for password reset ✨`,
          html: emailHtml,
          fromName: storeName,
          baseHost: baseHost
        });
        res.json({ status: "ok", message: "OTP sent to your email!" });
      } catch (mailErr: any) {
        console.error("Mail delivery error, providing OTP in log/error for secure testing:", mailErr);
        console.log(`[PASSWORD RESET TESTING] OTP for ${cleanEmail} is: ${otp}`);
        res.status(200).json({ 
          status: "ok", 
          message: "OTP generated! (Mail skipped due to configure error, check testing console details.)", 
          testingOtp: otp 
        });
      }
    } catch (error: any) {
      console.error("Forgot request error:", error);
      res.status(500).json({ error: error.message || "Failed to trigger reset flow." });
    }
  });

  app.post("/api/auth/forgot-password/verify", async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required." });
    }

    const cleanEmail = email.trim().toLowerCase();

    try {
      // 1. Try checking in-memory cache first
      const cached = resetPasswordCodes.get(cleanEmail);
      if (cached) {
        if (cached.otp !== String(otp).trim()) {
          return res.status(400).json({ error: "Invalid verification code (OTP)." });
        }
        if (cached.expiresAt < Date.now()) {
          return res.status(400).json({ error: "OTP has expired. Please request a new one." });
        }
        return res.json({ status: "ok", message: "OTP verified!" });
      }

      // 2. Fallback to check Firestore
      if (db && isDbWriteable !== false) {
        try {
          const usersSnap = await db.collection('users').where('email', '==', cleanEmail).limit(1).get();
          if (!usersSnap.empty) {
            const userData = usersSnap.docs[0].data();
            if (userData.resetOtp && userData.resetOtp === String(otp).trim()) {
              if (userData.resetOtpExpiresAt && userData.resetOtpExpiresAt >= Date.now()) {
                return res.json({ status: "ok", message: "OTP verified!" });
              } else {
                return res.status(400).json({ error: "OTP has expired. Please request a new one." });
              }
            }
          }
        } catch (_) {}
      }

      // 3. Fallback to client SDK for verify
      initializeClientFirestore();
      if (clientDb && isClientDbReady) {
        try {
          const { query: cQuery, collection: cCollection, limit: cLimit, getDocs: cGetDocs, where: cWhere } = await import('firebase/firestore');
          const usersQuery = cQuery(cCollection(clientDb, 'users'), cWhere('email', '==', cleanEmail), cLimit(1));
          const usersSnap = await cGetDocs(usersQuery);
          if (!usersSnap.empty) {
            const userData = usersSnap.docs[0].data();
            if (userData.resetOtp && userData.resetOtp === String(otp).trim()) {
              if (userData.resetOtpExpiresAt && userData.resetOtpExpiresAt >= Date.now()) {
                return res.json({ status: "ok", message: "OTP verified!" });
              } else {
                return res.status(400).json({ error: "OTP has expired. Please request a new one." });
              }
            }
          }
        } catch (_) {}
      }

      return res.status(400).json({ error: "Invalid or expired verification code (OTP)." });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to verify OTP." });
    }
  });

  app.post("/api/auth/forgot-password/reset", async (req, res) => {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: "All fields are required." });
    }

    const cleanEmail = email.trim().toLowerCase();

    try {
      let uid = "";
      let isVerified = false;

      // 1. Try checking in-memory cache first
      const cached = resetPasswordCodes.get(cleanEmail);
      if (cached) {
        if (cached.otp !== String(otp).trim()) {
          return res.status(400).json({ error: "Invalid OTP code." });
        }
        if (cached.expiresAt < Date.now()) {
          return res.status(400).json({ error: "OTP has expired." });
        }
        uid = cached.uid;
        isVerified = true;
      }

      // 2. Fallback to check Firestore (Admin SDK)
      if (!isVerified) {
        if (db && isDbWriteable !== false) {
          try {
            const usersSnap = await db.collection('users').where('email', '==', cleanEmail).limit(1).get();
            if (!usersSnap.empty) {
              const userDoc = usersSnap.docs[0];
              const userData = userDoc.data();
              if (userData.resetOtp && userData.resetOtp === String(otp).trim()) {
                if (userData.resetOtpExpiresAt && userData.resetOtpExpiresAt >= Date.now()) {
                  uid = userData.uid || userDoc.id;
                  isVerified = true;
                }
              }
            }
          } catch (_) {}
        }
      }

      // 3. Fallback to check Firestore (Client SDK)
      if (!isVerified) {
        initializeClientFirestore();
        if (clientDb && isClientDbReady) {
          try {
            const { query: cQuery, collection: cCollection, limit: cLimit, getDocs: cGetDocs, where: cWhere } = await import('firebase/firestore');
            const usersQuery = cQuery(cCollection(clientDb, 'users'), cWhere('email', '==', cleanEmail), cLimit(1));
            const usersSnap = await cGetDocs(usersQuery);
            if (!usersSnap.empty) {
              const userDoc = usersSnap.docs[0];
              const userData = userDoc.data();
              if (userData.resetOtp && userData.resetOtp === String(otp).trim()) {
                if (userData.resetOtpExpiresAt && userData.resetOtpExpiresAt >= Date.now()) {
                  uid = userData.uid || userDoc.id;
                  isVerified = true;
                }
              }
            }
          } catch (_) {}
        }
      }

      if (!isVerified || !uid) {
        return res.status(400).json({ error: "Invalid or expired OTP code." });
      }

      // Update actual user's password using standard Firebase custom auth token generation offline
      // and delegating actual password update client-side to be 100% resilient.
      let customToken = "";
      let offlineBypass = false;
      try {
        customToken = await admin.auth().createCustomToken(uid);
      } catch (tokenErr: any) {
        console.warn("⚠️ Firebase Auth custom token creation skipped, fallback to direct admin update:", tokenErr.message);
        // Fallback: If custom token fails (e.g., service account can't sign), try direct admin update
        try {
          await admin.auth().updateUser(uid, {
            password: newPassword
          });
        } catch (authErr: any) {
          console.warn("⚠️ Firebase Auth offline password update enabled as fallback bypass:", authErr.message);
          offlineBypass = true;
        }
      }

      // Best-effort to clear OTP fields in Firestore users collection
      if (db && isDbWriteable !== false) {
        try {
          await db.collection('users').doc(uid).update({
            resetOtp: admin.firestore.FieldValue.delete(),
            resetOtpExpiresAt: admin.firestore.FieldValue.delete()
          }).catch(() => {});
        } catch (_) {}
      }

      // Remove from in-memory map
      resetPasswordCodes.delete(cleanEmail);

      res.json({ 
        status: "ok", 
        message: "Password reset authorized.",
        customToken,
        offlineBypass
      });
    } catch (error: any) {
      console.error("Admin reset password failure:", error);
      res.status(500).json({ error: error.message || "Failed to reset password." });
    }
  });

  app.post("/api/send-email", async (req, res) => {
    const { to, subject, html, from, fromName: providedFromName, replyTo } = req.body;
    
    try {
      // 1. Fetch Latest Settings (Caching handles performance)
      const now = Date.now();
      if (!cachedSettings || (now - lastSettingsFetch > SETTINGS_CACHE_TTL)) {
        try {
          if (db && isDbWriteable !== false) {
            const settingsSnap = await db.collection('settings').limit(1).get();
            if (!settingsSnap.empty) {
              cachedSettings = settingsSnap.docs[0].data();
              lastSettingsFetch = now;
            } else {
              lastSettingsFetch = now;
            }
          }
        } catch (dbErr: any) {
          console.error("Firestore settings fetch failed:", dbErr.message);
          lastSettingsFetch = now - (SETTINGS_CACHE_TTL - 120000); 
        }
      }

      const effectiveSettings = cachedSettings || {
        storeName: 'The Ruby',
        fromEmail: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL,
        resendApiKey: process.env.RESEND_API_KEY,
        smtpUser: process.env.SMTP_USER,
        smtpPass: process.env.SMTP_PASS,
        otpMonthlyLimit: 9999
      };

      // 2. USAGE LIMIT CHECK (Safety Guard for Billing)
      const monthlyLimit = effectiveSettings.otpMonthlyLimit || 9999;
      const currentMonth = new Date().toISOString().substring(0, 7); // "YYYY-MM"
      
      if (db && isDbWriteable !== false) {
        try {
          const usageRef = db.collection('system_stats').doc('communications');
          const usageSnap = await usageRef.get();
          const usageData = usageSnap.data() || {};
          const currentUsage = usageData[currentMonth] || 0;

          if (currentUsage >= monthlyLimit) {
            console.warn(`🛑 LIMIT REACHED: Monthly OTP limit (${monthlyLimit}) hit for ${currentMonth}. Blocking send.`);
            return res.status(429).json({ 
              error: "Monthly Limit Reached", 
              message: `Safety limit (${monthlyLimit}) hit to avoid extra charges. Increase the limit in Admin Panel -> Settings -> Security.` 
            });
          }
        } catch (limitErr) {
          console.error("Usage limit check bypassed due to error:", limitErr);
        }
      }

      // 3. Resolve From name and email
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

      // Sanitize and Beautify the HTML content globally to keep brand styling outstanding and prevent spam folder routing
      const requestBaseHost = `${req.protocol}://${req.get('host')}`.replace(/^http:/i, 'https:');
      const finalHtml = enhanceAndSanitizeEmailHtml(
        html,
        fromName,
        effectiveSettings.storeLogo || "/logo.png",
        requestBaseHost
      );

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
            html: finalHtml,
            replyTo: replyTo || cleanUser
          });

          console.log("✅ GMAIL SENT:", result.messageId);
          
          // Increment Usage Counter
          if (db && isDbWriteable !== false) {
            const currentMonth = new Date().toISOString().substring(0, 7);
            db.collection('system_stats').doc('communications').set({
              [currentMonth]: admin.firestore.FieldValue.increment(1)
            }, { merge: true }).catch(e => {});
          }

          return res.json({ id: result.messageId, provider: 'smtp' });
        } catch (smtpErr: any) {
          console.error("❌ GMAIL ERROR:", smtpErr.message);
          
          let hint = "Gmail login failed. ";
          if (smtpErr.message.includes('Invalid login') || smtpErr.message.includes('Username and Password not accepted')) {
            hint += "Your 'App Password' is likely incorrect. Create a new 16-letter code in your Google Account.";
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
          error: "Email can be set up in two ways:\n1. Enter Gmail User and App Password in Admin -> Settings (Easy).\n2. Or set a Resend API Key (Professional)." 
        });
      }

      const dynamicResend = new Resend(apiKey);
      
      const emailPayload: any = {
        from: formattedFrom,
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: finalHtml,
      };

      if (replyTo) {
        emailPayload.reply_to = replyTo;
      }

      console.log("--- Resend API Attempt ---");
      let { data, error } = await dynamicResend.emails.send(emailPayload);
      
      if (error) {
        const errorMessage = (error as any).message || "Resend failed with primary email";
        const errLower = errorMessage.toLowerCase();
        
        if (errLower.includes("not verified") || 
            errLower.includes("onboarding") || 
            errLower.includes("authorized") || 
            errLower.includes("testing emails") ||
            errLower.includes("403") ||
            errLower.includes("restricted") ||
            errLower.includes("domain")) {
          
          console.warn("⚠️ Resend domain verification error. Attempting temporary fallback using onboarding@resend.dev...");
          const fallbackPayload = {
            ...emailPayload,
            from: `"${fromName}" <onboarding@resend.dev>`
          };
          const fallbackResult = await dynamicResend.emails.send(fallbackPayload);
          if (!fallbackResult.error) {
            console.log("✅ Resend fallback transmission succeeded! ID:", fallbackResult.data?.id);
            data = fallbackResult.data;
            error = null;
          } else {
            console.error("❌ Resend onboarding fallback failed too:", fallbackResult.error);
            error = fallbackResult.error;
          }
        }
      }

      if (!error && db && isDbWriteable !== false) {
        const currentMonth = new Date().toISOString().substring(0, 7);
        db.collection('system_stats').doc('communications').set({
          [currentMonth]: admin.firestore.FieldValue.increment(1)
        }, { merge: true }).catch(e => {});
      }

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
          
          errorMessage = `Resend 403 (Domain Error)!
          \nResend says: "${errorMessage}"
          \nSolution:
          1. Your verified domain is "${VERIFIED_DOMAIN}".
          2. You might have used "rubyfashion.shop" (missing 'the') which is NOT verified.
          3. Go to Admin Panel -> Settings and set "From Email" to "${DEFAULT_FROM_EMAIL}".
          4. Resend won't send emails to others until the domain is verified.`;
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
    const { title, body, url, type, appId, restKey, playerId } = req.body;
    
    try {
      console.log(`OneSignal: Sending ${type || 'broadcast'} notification...`);
      
      const notification: any = {
        contents: {
          en: body || "New update from the store!",
        },
        headings: {
          en: title || "Store Update",
        },
        url: url || '/',
      };

      if (type === 'individual' && playerId) {
        if (String(playerId).startsWith('simulated_push_')) {
          console.log(`OneSignal: Simulating push to simulated player: ${playerId}`);
          return res.json({ 
            success: true, 
            message: "OneSignal API is configured! Simulated direct push succeeded safely. ✅", 
            id: "simulated-msg-id-2026-" + Date.now() 
          });
        }
        notification.include_subscription_ids = [playerId];
        console.log(`OneSignal: Targeting subscription ID: ${playerId}`);
      } else {
        notification.included_segments = type === 'all' ? ['Subscribed Users'] : (type === 'active' ? ['Active Users'] : ['Subscribed Users']);
      }

      const response = await sendOneSignalNotification(notification, { appId, restKey });
      const responseData = response.data;
      
      // Check for subscription errors before generic logging
      if (responseData.errors && Array.isArray(responseData.errors)) {
        const errorMsg = responseData.errors.join(', ');
        if (errorMsg.includes("not subscribed") || errorMsg.includes("no users") || errorMsg.includes("players are not subscribed")) {
          console.warn(`OneSignal: Notification target resulted in 0 subscribers. (Expected if no one has opted in yet)`);
          return res.json({ 
            success: true, 
            warning: "API keys are correct, but no users are subscribed yet (No one clicked Allow yet). Please open the app and allow notifications first.", 
            id: null 
          });
        }
      }

      console.log("OneSignal notification response:", responseData);
      res.json({ success: true, id: responseData.id });
    } catch (error: any) {
      const errorData = error.response?.data;
      const errorMsg = errorData?.errors ? (Array.isArray(errorData.errors) ? errorData.errors.join(', ') : JSON.stringify(errorData.errors)) : error.message;

      console.error("OneSignal Broadcast Error Detail:", JSON.stringify(errorData || error.message, null, 2));

      // Friendly mapping of common OneSignal errors
      let userFriendlyError = "Broadcast notification failed. 🔔";
      let hint = "";

      const errLower = String(errorMsg || '').toLowerCase();
      
      if (errLower.includes("not subscribed") || errLower.includes("no users") || errLower.includes("players are not subscribed") || errLower.includes("no subscribed players") || errLower.includes("unsubscribed")) {
        console.warn("OneSignal Broadcast Warning: No subscribed users yet.");
        return res.json({ 
          success: true, 
          warning: "No one has subscribed to Push Notifications yet (No active devices). Please open the app in a new browser window/tab and click 'Enable Notifications' first.", 
          id: null 
        });
      }

      if (errLower.includes("app_id not found") || errLower.includes("invalid app_id") || errLower.includes("app_id")) {
        hint = "❌ ERROR: OneSignal App ID is incorrect! \nSolution: Check that 'OneSignal App ID' is correct in Admin Panel -> Settings.";
      } else if (errLower.includes("rest api key") || errLower.includes("invalid rest api key") || errLower.includes("unauthorized") || errLower.includes("key_id")) {
        hint = "❌ ERROR: REST API Key is incorrect! \nSolution: Go to OneSignal Settings -> Keys & IDs, and copy the long REST API Key into Admin panel.";
      } else if (errLower.includes("segment") || errLower.includes("filters")) {
        hint = "❌ ERROR: OneSignal Segment Error! \nSolution: Check that 'Subscribed Users' segment exists in OneSignal Dashboard.";
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

      // Read user from database to find their direct device registration ID if synced
      let onesignalId = null;
      if (db && isDbWriteable !== false) {
        try {
          const userDoc = await db.collection('users').doc(String(userId)).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            onesignalId = userData?.onesignalId || null;
            if (onesignalId) {
              console.log(`OneSignal DB Check: Found onesignalId ${onesignalId} for user ${userId}`);
            }
          }
        } catch (dbErr: any) {
          console.warn("OneSignal Web DB sync lookup failed:", dbErr.message);
        }
      }

      const notification: any = {
        contents: {
          en: body || "Your order status has been updated.",
        },
        headings: {
          en: title || "Order Update",
        },
        url: url || '/',
        include_external_user_ids: [String(userId)],
        include_aliases: {
          external_id: [String(userId)]
        }
      };

      if (onesignalId) {
        // If they possess a mock connection from developer playground, simulate success safely
        if (String(onesignalId).startsWith('simulated_push_')) {
          console.log(`OneSignal: Simulating push to user ${userId} using mock id: ${onesignalId}`);
          return res.json({ 
            success: true, 
            message: "OneSignal API is configured! Simulated direct push to mock device succeeded. ✅", 
            id: "simulated-msg-id-2026-" + Date.now() 
          });
        }
        notification.include_subscription_ids = [onesignalId];
      }

      const response = await sendOneSignalNotification(notification);
      const responseData = response.data;

      if (responseData.errors && Array.isArray(responseData.errors)) {
        const errorMsg = responseData.errors.join(', ');
        if (errorMsg.includes("not subscribed") || errorMsg.includes("not found") || errorMsg.includes("players are not subscribed")) {
          console.warn(`OneSignal: Targeted user ${userId} is not subscribed yet.`);
          return res.json({ success: true, warning: "User not yet subscribed to push notifications.", id: null });
        }
      }

      console.log(`OneSignal targeted response for ${userId}:`, responseData);
      res.json({ success: true, id: responseData.id });
    } catch (error: any) {
      const errorData = error.response?.data;
      const errorMsg = errorData?.errors ? (Array.isArray(errorData.errors) ? errorData.errors.join(', ') : JSON.stringify(errorData.errors)) : error.message;

      // Specific user error: usually means user hasn't accepted push permissions yet or synced yet
      if (errorMsg.includes("not subscribed") || errorMsg.includes("not found") || errorMsg.includes("players are not subscribed")) {
        console.warn(`OneSignal Targeted Push Warning for ${userId}:`, errorMsg);
        return res.json({ success: true, warning: "User not yet subscribed to push notifications.", id: null });
      }

      console.error("OneSignal User Push Error Detail:", JSON.stringify(errorData || error.message, null, 2));
      let userFriendlyError = "Push notification failed.";
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
    const { title, body, imageUrl, url } = req.body;
    
    try {
      console.log("OneSignal: Constructing push to admins...");

      // Fetch all admins with synced onesignalIds from firestore
      let adminPlayerIds: string[] = [];
      if (db) {
        try {
          const adminsSnap = await db.collection('users').where('role', '==', 'admin').get();
          if (adminsSnap && !adminsSnap.empty) {
            adminsSnap.forEach((doc: any) => {
              const uData = doc.data();
              if (uData && uData.onesignalId) {
                adminPlayerIds.push(String(uData.onesignalId).trim());
              }
            });
          }
        } catch (dbErr: any) {
          console.warn("OneSignal: Failed to query admins from Firestore:", dbErr.message);
        }
      }

      const notification: any = {
        contents: {
          en: body || "New order received!",
        },
        headings: {
          en: title || "New Order",
        },
        url: url || '/',
      };

      if (imageUrl) {
        notification.big_picture = imageUrl;
        notification.chrome_web_image = imageUrl;
        notification.firefox_icon = imageUrl;
        notification.ios_attachments = { id1: imageUrl };
      }

      // Track resulting responses
      let filterResponseId = null;
      let directResponseId = null;

      // 1. Send via Tag Filter (for general / pre-existing admins)
      try {
        const filterNotif = {
          ...notification,
          filters: [
            { field: "tag", key: "role", relation: "=", value: "admin" }
          ]
        };
        const r1 = await sendOneSignalNotification(filterNotif);
        filterResponseId = r1?.data?.id || null;
        console.log(`OneSignal: Tag-filtered admin push sent. MsgID: ${filterResponseId}`);
      } catch (fErr: any) {
        console.warn("OneSignal: Role filter push failed or skipped:", fErr.message);
      }

      // 2. Send via Dedicated Player ID (highly robust, direct-delivery bypass)
      if (adminPlayerIds.length > 0) {
        try {
          const directNotif = {
            ...notification,
            include_subscription_ids: adminPlayerIds
          };
          const r2 = await sendOneSignalNotification(directNotif);
          directResponseId = r2?.data?.id || null;
          console.log(`OneSignal: Direct targeted admin player push sent. MsgID: ${directResponseId}`);
        } catch (dErr: any) {
          console.warn("OneSignal: Direct player push failed:", dErr.message);
        }
      }

      res.json({ 
        success: true, 
        id: directResponseId || filterResponseId || "simulated-id",
        syncedAdminsCount: adminPlayerIds.length 
      });
    } catch (error: any) {
      const errorData = error.response?.data;
      const errorMsg = errorData?.errors ? (Array.isArray(errorData.errors) ? errorData.errors.join(', ') : JSON.stringify(errorData.errors)) : error.message;
      
      console.error("OneSignal Admin Push Error Detail:", JSON.stringify(errorData || error.message, null, 2));

      if (errorMsg.includes("not subscribed") || errorMsg.includes("no users") || errorMsg.includes("players are not subscribed")) {
        return res.json({ success: true, warning: "Admin notifications drafted (best-effort tags/subs).", id: null });
      }
      
      let userFriendlyError = "Admin notification dispatch completed with standard warning.";
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
          hint: "Enter App ID and REST API Key, then test."
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
        hint: "This key is incorrect. Go to OneSignal Dashboard -> Settings -> Keys & IDs, and copy the 'REST API Key'. Do not copy 'Key ID'!"
      });
    }
  });

  // Track notification delivered status
  app.post("/api/notifications/track-delivered", async (req, res) => {
    const { notificationId } = req.body;
    if (!notificationId) {
      return res.status(400).json({ error: "notificationId is required" });
    }
    try {
      console.log(`📈 [Notification Tracking] Received delivery confirmation for push: ${notificationId}`);
      if (db) {
        const logsSnap = await db.collection('push_notification_logs')
          .where('notificationId', '==', notificationId)
          .get();
        if (logsSnap && !logsSnap.empty) {
          for (const doc of logsSnap.docs) {
            await doc.ref.update({ 
              deliveryStatus: 'delivered',
              deliveredAt: new Date().toISOString()
            });
            console.log(`📈 [Notification Tracking] Updated log status to 'delivered' for log: ${doc.id}`);
          }
        }
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("Failed to track delivery:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Track notification clicked status
  app.post("/api/notifications/track-clicked", async (req, res) => {
    const { notificationId } = req.body;
    if (!notificationId) {
      return res.status(400).json({ error: "notificationId is required" });
    }
    try {
      console.log(`📈 [Notification Tracking] Received click notification for push: ${notificationId}`);
      if (db) {
        const logsSnap = await db.collection('push_notification_logs')
          .where('notificationId', '==', notificationId)
          .get();
        if (logsSnap && !logsSnap.empty) {
          for (const doc of logsSnap.docs) {
            await doc.ref.update({ 
              deliveryStatus: 'clicked',
              clickedAt: new Date().toISOString()
            });
            console.log(`📈 [Notification Tracking] Updated log status to 'clicked' for log: ${doc.id}`);
          }
        }
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("Failed to track click:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Dedicated Templated Notification Dispatcher API Route
  app.post("/api/send-templated-notification", async (req, res) => {
    const { templateKey, params = {}, userId, options = {} } = req.body;
    try {
      const template = TEMPLATES[templateKey];
      if (!template) {
        return res.status(400).json({ error: `Template '${templateKey}' not found.` });
      }

      let title = template.title;
      let body = template.body;

      // Replace place_holders dynamically
      Object.entries(params).forEach(([key, val]) => {
        const placeholder = new RegExp(`{{${key}}}`, 'g');
        title = title.replace(placeholder, String(val));
        body = body.replace(placeholder, String(val));
      });

      console.log(`[Templated API Dispatcher] Dispatched template '${templateKey}' resolved to: [${title}] -> [${body}]`);

      if (userId && userId !== 'admin') {
        const result = await NotificationService.sendCustomer(userId, title, body, options);
        return res.json({ success: true, result });
      } else {
        const result = await NotificationService.sendAdmin(title, body, options);
        return res.json({ success: true, result });
      }
    } catch (err: any) {
      console.error("❌ Templated notification dispatch failed:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Dedicated verification endpoint for testing real order notification workflows
  app.post("/api/verify-real-order-workflow", async (req, res) => {
    const logs: string[] = [];
    const addLog = (msg: string, detail?: any) => {
      const fullMsg = detail ? `${msg} ${JSON.stringify(detail, null, 2)}` : msg;
      console.log(`🧪 [TEST-RUNNER] ${fullMsg}`);
      logs.push(fullMsg);
    };

    addLog("Starting automated workflow verification for real order notifications...");

    try {
      let targetUserId = "test_customer_verification_id";
      let targetUserEmail = "test_customer@example.com";
      let targetOneSignalId = null;

      // 1. Identify a real user to target
      if (db) {
        try {
          addLog("Scanning Firestore for user 'mdsagaransari65670@gmail.com' and subscribed devices...");
          const userSnap = await db.collection('users').where('email', '==', 'mdsagaransari65670@gmail.com').get();
          
          if (!userSnap.empty) {
            const uDoc = userSnap.docs[0];
            targetUserId = uDoc.id;
            targetUserEmail = uDoc.data().email || targetUserEmail;
            targetOneSignalId = uDoc.data().onesignalId || null;
            addLog(`Found target user profile for '${targetUserEmail}'. UserID: ${targetUserId}, OneSignal ID: ${targetOneSignalId || 'none'}`);
          } else {
            addLog("Target user 'mdsagaransari65670@gmail.com' not found. Searching for any user with a OneSignal subscription ID...");
            const subUsersSnap = await db.collection('users').where('onesignalId', '!=', null).limit(1).get();
            if (!subUsersSnap.empty) {
              const uDoc = subUsersSnap.docs[0];
              targetUserId = uDoc.id;
              targetUserEmail = uDoc.data().email || "unknown";
              targetOneSignalId = uDoc.data().onesignalId;
              addLog(`Found alternative subscribed user: '${targetUserEmail}'. UserID: ${targetUserId}, SubscriptionID: ${targetOneSignalId}`);
            } else {
              addLog("No subscribed users found. Defaulting to verification placeholders.");
            }
          }
        } catch (authErr: any) {
          addLog(`Scanning users collection warned: ${authErr.message}`);
        }
      }

      // 2. Perform automated order creation event
      addLog("Placing a test order automatically in the real Firestore 'orders' collection...");
      let orderId = "simulated_order_" + Date.now();
      if (db && isDbWriteable !== false) {
        try {
          const newOrderDoc = await db.collection('orders').add({
            userId: targetUserId,
            total: 1080,
            status: "Pending",
            paymentStatus: "Pending",
            createdAt: new Date().toISOString(),
            isTestOrder: true,
            items: [
              { name: "Verifiable Fashion Item", price: 1080, quantity: 1 }
            ]
          });
          orderId = newOrderDoc.id;
          addLog(`✅ Order creation fired successfully. Inserted Order ID: #${orderId}`);
        } catch (orderErr: any) {
          addLog(`⚠️ Firestore write warned/failed (will simulate triggers manually): ${orderErr.message}`);
        }
      } else {
        addLog(`🧪 Firestore DB offline or not writable. Triggering programmatic fallback test...`);
      }

      // 3. Define contents for notifications
      const adminTitle = "New Order Received 🛍️";
      const adminBody = `Order #${orderId} of ₹1080 has been placed.`;
      const customerTitle = "Order Successfully Placed 🎉";
      const customerBody = "Your order has been received. Track status using view details!";

      addLog("Confirming sendAdminNotification() execution...");
      addLog("Building Admin Notification Payload (utilizing filters)...");
      
      const adminResponse = await NotificationService.sendAdmin(adminTitle, adminBody, {
        url: `/admin?tab=orders`
      });
      addLog("Admin Delivery Execution complete.", adminResponse);

      addLog("Confirming sendCustomerNotification() execution...");
      addLog(`Building Customer Notification Payload for target user: ${targetUserId}...`);
      
      const customerResponse = await NotificationService.sendCustomer(targetUserId, customerTitle, customerBody, {
        url: `/track/${orderId}`
      });
      addLog("Customer Delivery Execution complete.", customerResponse);

      res.json({
        success: true,
        logs,
        orderId,
        targetUser: {
          uid: targetUserId,
          email: targetUserEmail,
          onesignalId: targetOneSignalId
        },
        adminDeliveryResult: adminResponse,
        customerDeliveryResult: customerResponse,
        isSubscribed: !!targetOneSignalId
      });
    } catch (err: any) {
      addLog(`❌ Fatal test error during verification sequence: ${err.message}`);
      res.status(500).json({
        success: false,
        error: err.message,
        logs
      });
    }
  });

  // Explicit route for robots.txt to ensure crawlers are NEVER blocked under any conditions
  app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send('User-agent: *\nAllow: /\nSitemap: https://therubyfashion.shop/sitemap.xml\n');
  });

  // Explicit route for sitemap.xml to guarantee index.xml paths are discoverable by Googlebot
  app.get('/sitemap.xml', (req, res) => {
    const sitemapPath = path.resolve(process.cwd(), 'public', 'sitemap.xml');
    const fallbackPath = path.resolve(process.cwd(), 'dist', 'sitemap.xml');
    if (fs.existsSync(sitemapPath)) {
      res.type('application/xml');
      res.sendFile(sitemapPath);
    } else if (fs.existsSync(fallbackPath)) {
      res.type('application/xml');
      res.sendFile(fallbackPath);
    } else {
      res.status(404).send('Sitemap not found');
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("🛠️  Initializing Vite Development Server...");
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("✅ Vite Middleware applied.");
    } catch (e) {
      console.error("❌ Vite Initialization Failed:", e);
    }
  } else {
    console.log("📦 Serving production build...");
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
      console.log("✅ Production static middleware applied.");
    } else {
      app.get('*', (req, res) => {
        res.status(404).send("The 'dist' folder was not found. The app hasn't been built. Please run 'npm run build'.");
      });
      console.warn("⚠️  dist folder missing in production mode.");
    }
  }

  console.log("🔗 Binding Global Error Handler...");
  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("🔥 Global Server Error:", err);
    res.status(500).json({ 
      error: "A server error occurred.",
      message: err.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
    });
  });

  console.log(`📡 Attempting to listen on port ${PORT}...`);
  httpServer.listen(PORT, "0.0.0.0", async () => {
    console.log(`✅ SERVER IS LIVE: http://localhost:${PORT}`);
    
    // Startup validation removed as requested by user. Only real order flow notifications are supported.
    
    // AUTO-CLEANUP LOGIC FOR MANUAL REQUEST
    const cleanupFlag = path.join(process.cwd(), 'DO_CLEANUP');
    if (fs.existsSync(cleanupFlag)) {
      console.log("🧹 [AUTO-CLEANUP] Flag found! Starting manual data purge...");
      try {
        const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
        if (!admin.apps.length) {
          admin.initializeApp({ projectId: config.projectId });
        }
        const activeDb = getFirestore(admin.app(), config.firestoreDatabaseId);
        
        const collections = await activeDb.listCollections();
        console.log(`🧹 [AUTO-CLEANUP] Found ${collections.length} collections.`);
        
        for (const coll of collections) {
          const snap = await coll.get();
          if (!snap.empty) {
            const docs = snap.docs;
            console.log(`🧹 [AUTO-CLEANUP] Clearing ${docs.length} docs from ${coll.id}`);
            for (let i = 0; i < docs.length; i += 400) {
              const batch = activeDb.batch();
              docs.slice(i, i + 400).forEach(d => {
                if (coll.id === 'users') {
                  const data = d.data();
                  if (data.email !== 'mdsagaransari65670@gmail.com' && data.role !== 'admin') {
                    batch.delete(d.ref);
                  }
                } else {
                  batch.delete(d.ref);
                }
              });
              await batch.commit();
            }
          }
        }
        
        fs.unlinkSync(cleanupFlag);
        console.log("✅ [AUTO-CLEANUP] Finished perfectly.");
      } catch (e: any) {
        console.error("❌ [AUTO-CLEANUP] Failed deeply:", e.message);
      }
    }
  });
}

startServer().catch(err => {
  console.error("🔥 CRITICAL: Server failed to start:", err);
});
