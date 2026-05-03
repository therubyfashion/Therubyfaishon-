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
}) => {
  try {
    // 1. Store in Firestore for history
    await addDoc(collection(db, 'notifications'), {
      ...data,
      userId: data.userId || null,
      isRead: false,
      createdAt: new Date().toISOString()
    });

    // 2. Trigger Push Notification
    const pushData = {
      title: data.title,
      body: data.body,
      url: '/notifications', // Always link to notifications page as per request
      userId: data.userId
    };

    if (data.userId) {
      // Targeted push for specific user
      fetch('/api/send-user-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pushData)
      }).catch(e => console.error("Push failed:", e));
    } else {
      // Broadcast push for global alerts
      fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...pushData,
          type: 'all'
        })
      }).catch(e => console.error("Broadcast push failed:", e));
    }
  } catch (error) {
    console.error("Error sending notification:", error);
  }
};
