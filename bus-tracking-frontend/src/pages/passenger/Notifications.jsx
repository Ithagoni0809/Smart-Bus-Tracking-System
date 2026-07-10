// src/pages/passenger/Notifications.jsx
import React, { useState, useEffect } from 'react';
import { Bell, CheckCheck, Bus, AlertTriangle, Info, XCircle } from 'lucide-react';
import { notificationAPI } from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const typeConfig = {
  'bus-arriving':   { icon: Bus,           color: 'text-green-500',  bg: 'bg-green-50 dark:bg-green-900/20' },
  'bus-delayed':    { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
  'bus-cancelled':  { icon: XCircle,       color: 'text-red-500',    bg: 'bg-red-50 dark:bg-red-900/20' },
  'emergency-alert':{ icon: AlertTriangle, color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-900/20' },
  'general':        { icon: Info,          color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
};

const Notifications = () => {
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await notificationAPI.getAll({ limit: 50 });
        setNotifications(res.data.notifications || []);
      } catch {
        // Notifications API may not be fully wired yet — show empty gracefully
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Real-time socket notifications
  useEffect(() => {
    if (!socket) return;
    const handleNew = (data) => {
      const newNotif = { _id: Date.now(), ...data, isRead: false, createdAt: new Date() };
      setNotifications((prev) => [newNotif, ...prev]);
      toast(data.message || data.title, { icon: '🔔' });
    };
    socket.on('delay-notification', handleNew);
    socket.on('trip-started',       handleNew);
    return () => {
      socket.off('delay-notification', handleNew);
      socket.off('trip-started',       handleNew);
    };
  }, [socket]);

  const markAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      toast.error('Failed to mark as read');
    }
  };

  const markRead = async (id) => {
    try {
      await notificationAPI.markRead(id);
      setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, isRead: true } : n));
    } catch {}
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Bell size={22} className="text-purple-500" /> Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm text-purple-600 dark:text-purple-400 mt-0.5">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn-secondary text-sm gap-1.5">
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="You'll get alerts when your bus is arriving, delayed, or cancelled." />
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const cfg = typeConfig[notif.type] || typeConfig.general;
            const Icon = cfg.icon;
            return (
              <button
                key={notif._id}
                onClick={() => !notif.isRead && markRead(notif._id)}
                className={`w-full text-left card flex gap-3 transition-all hover:shadow-md ${
                  !notif.isRead ? 'border-purple-200 dark:border-purple-700 bg-purple-50/30 dark:bg-purple-900/10' : ''
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                  <Icon size={18} className={cfg.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-semibold ${!notif.isRead ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                      {notif.title}
                    </p>
                    {!notif.isRead && <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0 mt-1.5" />}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{notif.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notifications;
