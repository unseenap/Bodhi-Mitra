import { Bell, BellRinging, Check, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useNotificationCenter, type AppNotification } from "../../context/NotificationCenterContext";

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(value));
}

function NotificationItem({ notification, onOpen }: { notification: AppNotification; onOpen: (notification: AppNotification) => void }) {
  return (
    <button className={`notification-preview-item priority-${notification.priority}${notification.readAt ? " is-read" : ""}`} type="button" onClick={() => onOpen(notification)}>
      <span className="notification-preview-icon" aria-hidden="true">
        {notification.priority === "critical" ? <WarningCircle weight="fill" /> : <BellRinging weight="fill" />}
      </span>
      <span className="notification-preview-copy">
        <span><strong>{notification.title}</strong><time dateTime={notification.createdAt}>{relativeTime(notification.createdAt)}</time></span>
        <small>{notification.message}</small>
      </span>
      {!notification.readAt && <span className="notification-unread-marker"><span className="sr-only">Unread</span></span>}
    </button>
  );
}

export function NotificationBell({ mobile = false }: { mobile?: boolean }) {
  const { notifications, unread, loading, error, markRead, acknowledge, markAllRead } = useNotificationCenter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  async function openNotification(notification: AppNotification) {
    try {
      if (notification.priority === "critical" || notification.priority === "high") await acknowledge(notification.id);
      else await markRead(notification.id);
    } catch { /* The shared context restores server state. */ }
    setOpen(false);
    if (notification.actionUrl) navigate(notification.actionUrl);
  }

  return (
    <div className={`notification-bell${mobile ? " notification-bell--mobile" : ""}`} ref={rootRef}>
      <button
        className="notification-bell-trigger"
        type="button"
        aria-label={`Notifications, ${unread} unread`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        {unread ? <BellRinging weight="fill" /> : <Bell />}
        {unread > 0 && <span className="notification-badge" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <section className="notification-popover" role="dialog" aria-label="Recent notifications">
          <header>
            <div><strong>Notifications</strong><small>{unread ? `${unread} need your attention` : "You are all caught up"}</small></div>
            {unread > 0 && <button type="button" onClick={() => void markAllRead()}><Check /> Mark all read</button>}
          </header>
          <div className="notification-preview-list" aria-live="polite">
            {loading && <div className="notification-preview-state"><span className="notification-skeleton" /><span className="notification-skeleton" /><span className="notification-skeleton" /></div>}
            {!loading && error && <div className="notification-preview-state is-error"><WarningCircle /> <span><strong>Could not load notifications</strong><small>{error}</small></span></div>}
            {!loading && !error && !notifications.length && <div className="notification-preview-state"><Bell /><span><strong>No notifications yet</strong><small>Important support updates will appear here.</small></span></div>}
            {!loading && !error && notifications.map(notification => <NotificationItem key={notification.id} notification={notification} onOpen={openNotification} />)}
          </div>
          <footer><Link to="/notifications" onClick={() => setOpen(false)}>View all notifications</Link></footer>
        </section>
      )}
    </div>
  );
}
