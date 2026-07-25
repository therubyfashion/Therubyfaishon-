import { supabase } from '../supabase';
import { Notification } from '../types';

// In-memory sliding window cache for client-side deduplication (fingerprint -> timestamp)
const recentNotifCache = new Map<string, number>();

// Helper to detect OTP codes or verification security text
export const isOtpNotification = (title: string, body: string): boolean => {
  const text = `${title} ${body}`.toLowerCase();
  if (
    text.includes('otp') ||
    text.includes('verification code') ||
    text.includes('passcode') ||
    text.includes('reset code') ||
    text.includes('one-time password')
  ) {
    return true;
  }
  // Check pattern of 4 to 8 digits with security keywords
  if (/\b\d{4,8}\b/.test(text) && (text.includes('code') || text.includes('verify') || text.includes('security') || text.includes('password'))) {
    return true;
  }
  return false;
};

// Helper to detect if a notification is admin-only
export const isAdminAlert = (type: string, title: string, body: string): boolean => {
  if (type === 'alert') return true;
  const text = `${title} ${body}`.toLowerCase();
  return (
    text.includes('new order received') ||
    text.includes('low stock') ||
    text.includes('admin alert') ||
    text.includes('inventory alert') ||
    text.includes('system warning')
  );
};

export const sendNotification = async (data: {
  userId?: string;
  title: string;
  body: string;
  type: 'order' | 'coupon' | 'alert' | 'promotion';
  iconType: string;
  link?: string;
}, skipPush = false) => {
  try {
    // Rule 1: Never store OTP codes or verification codes in the in-app notification feed
    if (isOtpNotification(data.title, data.body)) {
      console.warn("🔒 [sendNotification] Suppressed OTP / verification code from in-app notification feed for privacy & security.");
      return;
    }

    // Rule 2: Admin-only alerts should never be saved with user_id = null in public customer pool
    let targetUserId = data.userId || null;
    if (!targetUserId && isAdminAlert(data.type, data.title, data.body)) {
      // Fetch admin user IDs to route specifically to admins instead of broadcasting to customers
      try {
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'admin');

        if (adminProfiles && adminProfiles.length > 0) {
          for (const admin of adminProfiles) {
            await sendNotification({ ...data, userId: admin.id }, skipPush);
          }
          return;
        } else {
          console.warn("⚠️ [sendNotification] Admin alert triggered but no admin profile found. Suppressed from public feed.");
          return;
        }
      } catch (adminErr) {
        console.warn("⚠️ [sendNotification] Admin profile lookup failed:", adminErr);
        return;
      }
    }

    // Rule 3: Deduplication check (In-memory + Database)
    const dedupKey = `${targetUserId || 'global'}:${data.title.trim()}:${data.link || '/notifications'}`;
    const now = Date.now();
    const lastSent = recentNotifCache.get(dedupKey);
    if (lastSent && now - lastSent < 20000) { // 20-second client window
      console.log(`⚠️ [sendNotification Deduplication] Suppressed duplicate notification trigger for key: ${dedupKey}`);
      return;
    }
    recentNotifCache.set(dedupKey, now);

    // Database deduplication check (within 60 seconds)
    try {
      const oneMinuteAgo = new Date(now - 60000).toISOString();
      let query = supabase
        .from('notifications')
        .select('id')
        .eq('title', data.title)
        .gte('created_at', oneMinuteAgo)
        .limit(1);

      if (targetUserId) {
        query = query.eq('user_id', targetUserId);
      } else {
        query = query.is('user_id', null);
      }

      const { data: existingNotifs } = await query;
      if (existingNotifs && existingNotifs.length > 0) {
        console.log(`⚠️ [sendNotification DB Deduplication] Duplicate notification row already exists within last 60s: ${data.title}`);
        return;
      }
    } catch (dbCheckErr) {
      console.warn("⚠️ [sendNotification] DB deduplication check error:", dbCheckErr);
    }

    // Insert into Supabase notifications table for in-app history
    try {
      const { error: sbError } = await supabase
        .from('notifications')
        .insert({
          user_id: targetUserId,
          title: data.title,
          body: data.body,
          type: data.type,
          link: data.link || '/notifications',
          icon_type: data.iconType || data.type || 'order',
          is_read: false,
          created_at: new Date().toISOString()
        });

      if (sbError) {
        console.warn("⚠️ [sendNotification] Supabase notification write error:", sbError.message);
      } else {
        console.log("📝 [sendNotification] Saved in-app notification to Supabase:", data.title);
      }
    } catch (sbErr: any) {
      // Rule 4: Catch errors and do NOT create raw error/retry log rows in customer feed
      console.warn("⚠️ [sendNotification] Failed to store in-app notification in Supabase:", sbErr?.message || sbErr);
    }

    // Trigger Push Notification (unless skipped)
    if (skipPush) {
      console.log(`ℹ️ [sendNotification] Recorded in-app notification in DB but skipped push trigger: ${data.title}`);
      return;
    }

    const pushData = {
      title: data.title,
      body: data.body,
      url: data.link || '/notifications',
      userId: targetUserId
    };

    if (targetUserId) {
      try {
        const response = await fetch('/api/send-user-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify(pushData)
        });
        if (!response.ok) {
          console.warn("Targeted push notification returned non-ok status:", response.status);
        }
      } catch (e) {
        // Rule 4: Log push failure without creating customer error notification entries
        console.error("Push failed:", e);
      }
    } else {
      try {
        const response = await fetch('/api/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({
            ...pushData,
            type: 'all'
          })
        });
        if (!response.ok) {
          console.warn("Broadcast push notification returned non-ok status:", response.status);
        }
      } catch (e) {
        console.error("Broadcast push failed:", e);
      }
    }
  } catch (error) {
    console.error("Error in sendNotification:", error);
  }
};

