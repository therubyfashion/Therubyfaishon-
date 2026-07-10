import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
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
    // 1. Store in Firestore for history
    await addDoc(collection(db, 'notifications'), {
      ...data,
      userId: data.userId || null,
      isRead: false,
      createdAt: new Date().toISOString()
    });

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
