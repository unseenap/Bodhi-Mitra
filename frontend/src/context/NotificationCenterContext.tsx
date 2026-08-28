import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: "critical" | "high" | "normal" | "low";
  actionUrl?: string;
  readAt?: string;
  acknowledgedAt?: string;
  createdAt: string;
  expiresAt?: string;
};

type NotificationCenterValue = {
  notifications: AppNotification[];
  unread: number;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationCenterContext = createContext<NotificationCenterValue | null>(null);

export function NotificationCenterProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setError("");
      const [list, count] = await Promise.all([
        api<{ notifications: AppNotification[] }>("/notifications?limit=8"),
        api<{ unread: number }>("/notifications/unread-count")
      ]);
      setNotifications(list.notifications);
      setUnread(count.unread);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Notifications could not be loaded");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const socket = getSocket();
    const onNotification = (notification: AppNotification) => {
      setNotifications(current => [notification, ...current.filter(item => item.id !== notification.id)].slice(0, 8));
      setUnread(current => current + (notification.readAt ? 0 : 1));
    };
    const onReconnect = () => void refresh();
    socket.on("notification:new", onNotification);
    socket.io.on("reconnect", onReconnect);
    return () => {
      socket.off("notification:new", onNotification);
      socket.io.off("reconnect", onReconnect);
    };
  }, [refresh]);

  const markRead = useCallback(async (id: string) => {
    const current = notifications.find(item => item.id === id);
    if (current?.readAt) return;
    const readAt = new Date().toISOString();
    setNotifications(items => items.map(item => item.id === id ? { ...item, readAt } : item));
    setUnread(value => Math.max(0, value - 1));
    try {
      await api(`/notifications/${id}/read`, { method: "PATCH" });
    } catch (requestError) {
      await refresh();
      throw requestError;
    }
  }, [notifications, refresh]);

  const markAllRead = useCallback(async () => {
    const readAt = new Date().toISOString();
    setNotifications(items => items.map(item => ({ ...item, readAt: item.readAt ?? readAt })));
    setUnread(0);
    try {
      await api("/notifications/mark-all-read", { method: "POST" });
    } catch (requestError) {
      await refresh();
      throw requestError;
    }
  }, [refresh]);

  const value = useMemo(() => ({ notifications, unread, loading, error, refresh, markRead, markAllRead }), [notifications, unread, loading, error, refresh, markRead, markAllRead]);
  return <NotificationCenterContext.Provider value={value}>{children}</NotificationCenterContext.Provider>;
}

export function useNotificationCenter() {
  const value = useContext(NotificationCenterContext);
  if (!value) throw new Error("useNotificationCenter must be inside NotificationCenterProvider");
  return value;
}
