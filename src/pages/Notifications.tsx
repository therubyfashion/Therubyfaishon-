import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Bell, 
  Truck, 
  Tag, 
  Star, 
  CreditCard, 
  AlertCircle, 
  Info,
  CheckCircle2,
  Package,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { format, isToday, isYesterday, parseISO } from 'date-fns';

const iconMap: Record<string, React.ReactNode> = {
  truck: <Truck size={20} className="text-red-500" />,
  tag: <Tag size={20} className="text-red-500" />,
  star: <Star size={20} className="text-red-500" />,
  card: <CreditCard size={20} className="text-red-500" />,
  alert: <AlertCircle size={20} className="text-red-500" />,
  info: <Info size={20} className="text-red-500" />,
  success: <CheckCircle2 size={20} className="text-red-500" />,
  package: <Package size={20} className="text-red-500" />,
  order: <Package size={20} className="text-red-500" />,
  coupon: <Tag size={20} className="text-red-500" />,
};

const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { notifications, unreadCount, markAllAsRead, markAsRead, loading } = useNotifications();

  const [permissionGranted, setPermissionGranted] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const OS = (window as any).OneSignal;
      if (OS && OS.Notifications) {
        return OS.Notifications.permission === true || OS.Notifications.permission === 'granted';
      }
      if ('Notification' in window) {
        return Notification.permission === 'granted';
      }
    }
    return false;
  });

  const [oneSignalActive, setOneSignalActive] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return !!(window as any).OneSignal;
    }
    return false;
  });

  useEffect(() => {
    // Mark all as read when page is opened or notifications are loaded
    markAllAsRead();
  }, [notifications, markAllAsRead]);

  useEffect(() => {
    const checkPermission = setInterval(() => {
      const OS = (window as any).OneSignal;
      setOneSignalActive(!!OS);
      if (OS && OS.Notifications) {
        const granted = OS.Notifications.permission === true || OS.Notifications.permission === 'granted';
        setPermissionGranted(granted);
      } else if ('Notification' in window) {
        setPermissionGranted(Notification.permission === 'granted');
      }
    }, 1500);
    return () => clearInterval(checkPermission);
  }, []);

  const requestPushPermission = async () => {
    try {
      const OS = (window as any).OneSignal;
      if (OS && OS.Notifications) {
        await OS.Notifications.requestPermission();
        const granted = OS.Notifications.permission === true || OS.Notifications.permission === 'granted';
        setPermissionGranted(granted);
      } else if ('Notification' in window) {
        const res = await Notification.requestPermission();
        setPermissionGranted(res === 'granted');
      } else {
        alert("Push notifications are not supported on this device/browser.");
      }
    } catch (e) {
      console.error("Error requesting permission:", e);
    }
  };

  const groupNotifications = () => {
    const today: any[] = [];
    const yesterday: any[] = [];
    const older: any[] = [];

    notifications.forEach(n => {
      let date: Date;
      if (n.createdAt && typeof n.createdAt === 'object' && 'toDate' in n.createdAt) {
        date = (n.createdAt as any).toDate();
      } else if (typeof n.createdAt === 'string') {
        date = parseISO(n.createdAt);
      } else {
        date = new Date();
      }

      if (isToday(date)) {
        today.push(n);
      } else if (isYesterday(date)) {
        yesterday.push(n);
      } else {
        older.push(n);
      }
    });

    return { today, yesterday, older };
  };

  const { today, yesterday, older } = groupNotifications();

  const renderNotificationItem = (notification: any) => {
    const Icon = iconMap[notification.iconType?.toLowerCase()] || iconMap[notification.type?.toLowerCase()] || <Bell size={20} className="text-red-500" />;
    
    const displayDate = (dateVal: any) => {
      let date: Date;
      if (dateVal && typeof dateVal === 'object' && 'toDate' in dateVal) {
        date = dateVal.toDate();
      } else if (typeof dateVal === 'string') {
        date = parseISO(dateVal);
      } else {
        date = new Date();
      }
      return format(date, 'h a');
    };

    return (
      <motion.div
        key={notification.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => {
          markAsRead(notification.id);
          if (notification.link) navigate(notification.link);
        }}
        className={`flex items-start gap-4 p-4 rounded-2xl transition-colors cursor-pointer ${
          !notification.isRead ? 'bg-gray-50' : 'bg-white'
        }`}
      >
        <div className="w-12 h-12 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center flex-shrink-0">
          {Icon}
        </div>
        <div className="flex-grow">
          <div className="flex justify-between items-start mb-1">
            <h3 className={`text-sm font-semibold capitalize ${!notification.isRead ? 'text-black' : 'text-gray-700'}`}>
              {notification.title}
            </h3>
            <span className="text-[10px] text-gray-400 font-medium">
              {displayDate(notification.createdAt)}
            </span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
            {notification.body || notification.message}
          </p>
        </div>
      </motion.div>
    );
  };

  const renderSection = (title: string, items: any[]) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4 px-2">
          <h2 className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
            {title}
          </h2>
          <button 
            onClick={markAllAsRead}
            className="text-[10px] font-bold text-red-500 uppercase hover:underline"
          >
            Mark all as read
          </button>
        </div>
        <div className="space-y-4">
          {items.map(n => renderNotificationItem(n))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md px-4 py-4 flex items-center justify-between border-b border-gray-50">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-bold text-gray-900">Notification</h1>
        <div className="flex items-center">
          {unreadCount > 0 && (
            <div className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              {unreadCount} NEW
            </div>
          )}
          <div className="w-10" /> {/* Spacer */}
        </div>
      </div>

      <div className="px-4 py-6">
        {/* Push Notification Permission Banner */}
        {!permissionGranted && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0 text-rose-600">
                <Bell size={20} className="animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-900">Enable Push Notifications</h4>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                  Allow notifications to receive real-time updates and checkout reminders on this device!
                </p>
              </div>
            </div>
            <button
              onClick={requestPushPermission}
              className="self-start sm:self-center bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold px-4 py-2 rounded-xl transition-all shadow-sm shrink-0"
            >
              Enable Now ✨
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Bell className="animate-bounce mb-4 text-gray-200" size={48} />
            <p className="text-sm">Loading your updates...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-300">
            <Bell className="mb-4 text-gray-200" size={64} />
            <h3 className="text-lg font-bold text-gray-900 mb-2">No notifications yet</h3>
            <p className="text-sm text-gray-500 text-center max-w-[250px]">
              We'll notify you when something important happens!
            </p>
          </div>
        ) : (
          <>
            {renderSection('TODAY', today)}
            {renderSection('YESTERDAY', yesterday)}
            {renderSection('OLDER', older)}
          </>
        )}

        {/* Push Notifications Diagnostics Panel */}
        <div className="mt-8 p-5 border border-gray-100 bg-gray-50/50 rounded-2xl">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 mb-3">
            <Info size={15} className="text-gray-500" />
            Push Delivery Diagnostics
          </h4>
          <div className="space-y-2 text-[11px] font-medium leading-relaxed">
            <div className="flex items-center justify-between py-1 border-b border-gray-100/50">
              <span className="text-gray-400">Device Permission:</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${permissionGranted ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                {permissionGranted ? 'GRANTED' : 'PENDING / BLOCKED'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-gray-100/50">
              <span className="text-gray-400">OneSignal Integration:</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${oneSignalActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                {oneSignalActive ? 'ACTIVE' : 'NOT INITIALIZED'}
              </span>
            </div>
            <div className="flex flex-col gap-1 py-1">
              <span className="text-gray-400">Synced Subscription ID:</span>
              <span className="font-mono text-[9px] text-gray-600 break-all bg-white p-1.5 rounded-lg border border-gray-100 block">
                {profile?.onesignalId || 'None synced yet. Open app in a new tab and grant permission.'}
              </span>
            </div>
            
            <div className="pt-3 border-t border-gray-100 mt-2">
              <h5 className="font-bold text-gray-800 text-[10px] uppercase tracking-wider mb-1.5">Troubleshooting Checklist:</h5>
              <ul className="list-disc pl-4 space-y-1 text-gray-500">
                <li><b>Iframe Block:</b> Browser security blocks push notification prompts inside sandbox iframes. Click the <b>"Open in New Tab"</b> icon at the top right of your preview to test.</li>
                <li><b>Mobile PWA Test:</b> On iOS (Safari) or Android (Chrome), use the "Add to Home Screen" option in your browser menu to run the app as a true PWA, then register.</li>
                <li><b>Admin Notifications:</b> Go to Admin Dashboard &rarr; Settings to configure <b>Gmail SMTP</b> or <b>Resend</b> to enable fully functional transaction and status emails.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Notifications;
