import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  orderBy, 
  writeBatch,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { Notification } from '../types';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  createNotification: (data: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  loading: true,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  createNotification: async () => {},
});

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Query for user-specific notifications AND global ones (userId = null)
    // Firestore doesn't support easy OR across fields in simple queries without composite indexes
    // So we'll just listen to user-specific ones for now, or combine client-side if needed.
    // Given the request, user specific is most important (order shipped etc)
    // Query for user-specific notifications
    const qUser = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    // Query for global notifications
    const qGlobal = query(
      collection(db, 'notifications'),
      where('userId', '==', null),
      orderBy('createdAt', 'desc')
    );

    let userData: Notification[] = [];
    let globalData: Notification[] = [];

    const updateCombined = () => {
      const combined = [...userData, ...globalData].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setNotifications(combined);
      setLoading(false);
    };

    const unsubscribeUser = onSnapshot(qUser, (snapshot) => {
      userData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Notification[];
      updateCombined();
    });

    const unsubscribeGlobal = onSnapshot(qGlobal, (snapshot) => {
      globalData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Notification[];
      updateCombined();
    });

    return () => {
      unsubscribeUser();
      unsubscribeGlobal();
    };
  }, [user]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = async (notificationId: string) => {
    try {
      const ref = doc(db, 'notifications', notificationId);
      await updateDoc(ref, { isRead: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      const unreadNotifications = notifications.filter(n => !n.isRead && n.userId === user.uid);
      if (unreadNotifications.length === 0) return;

      const batch = writeBatch(db);
      unreadNotifications.forEach(n => {
        const ref = doc(db, 'notifications', n.id);
        batch.update(ref, { isRead: true });
      });
      await batch.commit();
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const createNotification = async (data: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        ...data,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error creating notification:", error);
    }
  };

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      loading, 
      markAsRead, 
      markAllAsRead,
      createNotification
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
