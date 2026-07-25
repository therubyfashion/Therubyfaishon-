import { supabase } from '../supabase';
import { Notification } from '../types';

export const sendNotification = async (data: {
  userId?: string;
  title: string;
  body: string;
  type: 'order' | 'coupon' | 'alert' | 'promotion';
  iconType: string;
  link?: string;
}, skipPush = false) => {
  try {
    // 1. Store notification in Supabase notifications table for in-app history
    try {
      const targetUserId = data.userId || null;
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
        console.log("📝 [sendNotification] Successfully saved in-app notification to Supabase:", data.title);
      }
    } catch (sbErr: any) {
      console.warn("⚠️ [sendNotification] Failed to store in-app notification in Supabase:", sbErr?.message || sbErr);
    }

    // 2. Trigger Push Notification (unless skipped)
    if (skipPush) {
      console.log(`ℹ️ [sendNotification] Recorded in-app notification in DB but skipped redundant push trigger: ${data.title}`);
      return;
    }

    const pushData = {
      title: data.title,
      body: data.body,
      url: '/notifications', // Always link to notifications page as per request
      userId: data.userId
    };

    if (data.userId) {
      // Targeted push for specific user
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
        console.error("Push failed:", e);
      }
    } else {
      // Broadcast push for global alerts
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
    console.error("Error sending notification:", error);
  }
};
