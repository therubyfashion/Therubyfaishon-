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
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications } from '../contexts/NotificationContext';
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
  const { notifications, unreadCount, markAllAsRead, markAsRead, loading } = useNotifications();

  useEffect(() => {
    // Mark all as read when page is opened
    markAllAsRead();
  }, []);

  const groupNotifications = () => {
    const today: any[] = [];
    const yesterday: any[] = [];
    const older: any[] = [];

    notifications.forEach(n => {
      const date = parseISO(n.createdAt);
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
              {format(parseISO(notification.createdAt), 'h a')}
            </span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
            {notification.body}
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
      </div>
    </div>
  );
};

export default Notifications;
