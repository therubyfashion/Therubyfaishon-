import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabase';
import { useAuth } from './AuthContext';
import { Notification } from '../types';
import { isOtpNotification, isAdminAlert } from '../lib/notifications';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  createNotification: (data: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => Promise<void>;
  refetchNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  loading: true,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  createNotification: async () => {},
  refetchNotifications: async () => {},
});

// Helper to identify internal system error/retry strings that should never be shown to customers
const isInternalErrorLog = (title: string, body: string): boolean => {
  const text = `${title} ${body}`.toLowerCase();
  return (
    text.includes('onesignal error') ||
    text.includes('push failed') ||
    text.includes('retry attempt') ||
    text.includes('transient failure') ||
    text.includes('failed_exhausted') ||
    text.includes('delivery error')
  );
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const targetUserId = user.id || user.uid;
    const isUserAdmin = (user as any)?.role === 'admin';

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${targetUserId},user_id.is.null`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching notifications from Supabase:", error.message);
      } else if (data) {
        // Apply strict 4-rule audit filtering:
        const filtered = data.filter(row => {
          const title = row.title || '';
          const body = row.body || row.message || '';
          const type = row.type || 'order';

          // Rule 1: Exclude OTP codes or verification codes
          if (isOtpNotification(title, body)) return false;

          // Rule 4: Exclude raw system error / retry logs
          if (isInternalErrorLog(title, body)) return false;

          // Rule 2: Exclude admin-only alerts for non-admin users
          if (!isUserAdmin && isAdminAlert(type, title, body)) {
            return false;
          }

          return true;
        });

        // Rule 3: Client-side deduplication by fingerprint & timestamp proximity
        const seen = new Set<string>();
        const mapped: Notification[] = [];

        for (const row of filtered) {
          const title = row.title || '';
          const link = row.link || '/notifications';
          const rowUserId = row.user_id || row.userId || 'global';
          // Fingerprint key
          const dedupKey = `${rowUserId}:${title.trim()}:${link}`;

          if (seen.has(dedupKey)) {
            continue; // Skip duplicate row
          }
          seen.add(dedupKey);

          mapped.push({
            id: String(row.id),
            userId: row.user_id || row.userId || undefined,
            title: title,
            body: row.body || row.message || '',
            type: row.type || 'order',
            iconType: row.icon_type || row.iconType || row.type || 'order',
            isRead: Boolean(row.is_read ?? row.isRead ?? false),
            createdAt: row.created_at || row.createdAt || new Date().toISOString(),
            link: link
          });
        }

        setNotifications(mapped);
      }
    } catch (err: any) {
      console.error("Failed to load notifications from Supabase:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();

    if (!user) return;

    // Real-time listener for notifications
    const channel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    // Fallback polling every 8 seconds
    const interval = setInterval(() => {
      fetchNotifications();
    }, 8000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user, fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = useCallback(async (notificationId: string) => {
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n));
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    const targetUserId = user.id || user.uid;
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('is_read', false)
        .or(`user_id.eq.${targetUserId},user_id.is.null`);
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  }, [user]);

  const createNotification = useCallback(async (data: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => {
    // Rule 1: Never create OTP or verification code notifications
    if (isOtpNotification(data.title, data.body)) {
      console.warn("🔒 [createNotification] Suppressed OTP code from in-app notification feed.");
      return;
    }

    // Rule 4: Never create internal error / retry notifications
    if (isInternalErrorLog(data.title, data.body)) {
      return;
    }

    try {
      const targetUserId = data.userId || null;
      await supabase.from('notifications').insert({
        user_id: targetUserId,
        title: data.title,
        body: data.body,
        type: data.type,
        icon_type: data.iconType || data.type || 'order',
        link: data.link || '/notifications',
        is_read: false,
        created_at: new Date().toISOString()
      });
      fetchNotifications();
    } catch (error) {
      console.error("Error creating notification:", error);
    }
  }, [fetchNotifications]);

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      loading, 
      markAsRead, 
      markAllAsRead,
      createNotification,
      refetchNotifications: fetchNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);

