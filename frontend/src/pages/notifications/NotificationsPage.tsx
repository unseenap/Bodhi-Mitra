import { Bell, Check, DeviceMobile, Funnel, GearSix, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotificationCenter, type AppNotification } from "../../context/NotificationCenterContext";
import { api } from "../../lib/api";
import { disablePush, enablePush, supportsPush } from "../../lib/push";
import { useAuth } from "../../context/AuthContext";

type Filter = "all" | "unread" | "action_required";
const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "action_required", label: "Action required" }
];

type Preferences = {
  assessmentReminders: boolean;
  wellbeingReminders: boolean;
  maintenanceNotices: boolean;
  email: boolean;
};

function NotificationPreferences() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api<{ preferences: Preferences; pushSubscribed: boolean }>("/notifications/preferences")
      .then(result => { setPreferences(result.preferences); setPushSubscribed(result.pushSubscribed); })
      .catch(error => setMessage(error instanceof Error ? error.message : "Preferences could not be loaded"));
  }, []);

  async function togglePreference(key: keyof Preferences) {
    if (!preferences) return;
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    setSaving(key);
    setMessage("");
    try { await api("/notifications/preferences", { method: "PATCH", body: JSON.stringify({ [key]: next[key] }) }); }
    catch (error) { setPreferences(preferences); setMessage(error instanceof Error ? error.message : "Preference could not be saved"); }
    finally { setSaving(""); }
  }

  async function togglePush() {
    setSaving("push");
    setMessage("");
    try {
      if (pushSubscribed) await disablePush(); else await enablePush();
      setPushSubscribed(value => !value);
      setMessage(pushSubscribed ? "Browser notifications disabled on this device." : "Browser notifications enabled on this device.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Browser notification settings could not be changed"); }
    finally { setSaving(""); }
  }

  return (
    <section className={`notification-preferences${open ? " is-open" : ""}`}>
      <button className="notification-preferences-trigger" type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <span><GearSix /><span><strong>Delivery preferences</strong><small>Choose optional reminders and browser alerts.</small></span></span>
        <span>{open ? "Close" : "Manage"}</span>
      </button>
      {open && <div className="notification-preferences-body">
        <div className="notification-preference-row"><span><DeviceMobile /><span><strong>Browser notifications</strong><small>Receive privacy-safe updates when the app is closed.</small></span></span><button type="button" role="switch" aria-checked={pushSubscribed} disabled={!supportsPush() || saving === "push"} className={pushSubscribed ? "is-on" : ""} onClick={() => void togglePush()}><span /></button></div>
        {preferences && <>
          {user?.role === "student" && <><div className="notification-preference-row"><span><Bell /><span><strong>Weekly assessment reminder</strong><small>Notify me when my next check-in is ready.</small></span></span><button type="button" role="switch" aria-checked={preferences.assessmentReminders} disabled={saving === "assessmentReminders"} className={preferences.assessmentReminders ? "is-on" : ""} onClick={() => void togglePreference("assessmentReminders")}><span /></button></div>
          <div className="notification-preference-row"><span><Bell /><span><strong>Wellbeing resources</strong><small>Receive occasional, optional resource reminders.</small></span></span><button type="button" role="switch" aria-checked={preferences.wellbeingReminders} disabled={saving === "wellbeingReminders"} className={preferences.wellbeingReminders ? "is-on" : ""} onClick={() => void togglePreference("wellbeingReminders")}><span /></button></div></>}
          <div className="notification-preference-row"><span><WarningCircle /><span><strong>Maintenance notices</strong><small>Receive planned service and availability updates.</small></span></span><button type="button" role="switch" aria-checked={preferences.maintenanceNotices} disabled={saving === "maintenanceNotices"} className={preferences.maintenanceNotices ? "is-on" : ""} onClick={() => void togglePreference("maintenanceNotices")}><span /></button></div>
        </>}
        <p className="notification-preferences-note">Critical safety, active-session, and account-security updates always remain available in the app.</p>
        {message && <p className="notification-preferences-message" role="status">{message}</p>}
      </div>}
    </section>
  );
}

function fullTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function NotificationsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const { markRead, acknowledge, markAllRead, unread } = useNotificationCenter();
  const navigate = useNavigate();

  async function load(reset = true) {
    reset ? setLoading(true) : setLoadingMore(true);
    setError("");
    try {
      const currentCursor = reset ? null : cursor;
      const params = new URLSearchParams({ filter, limit: "20" });
      if (currentCursor) params.set("cursor", currentCursor);
      const result = await api<{ notifications: AppNotification[]; nextCursor: string | null }>(`/notifications?${params}`);
      setNotifications(items => reset ? result.notifications : [...items, ...result.notifications]);
      setCursor(result.nextCursor);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Notifications could not be loaded");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => { void load(true); }, [filter]);

  async function openItem(notification: AppNotification) {
    const needsAcknowledgement = (notification.priority === "critical" || notification.priority === "high") && !notification.acknowledgedAt;
    if (!notification.readAt || needsAcknowledgement) {
      try {
        const now = new Date().toISOString();
        if (needsAcknowledgement) await acknowledge(notification.id);
        else await markRead(notification.id);
        setNotifications(items => items.map(item => item.id === notification.id ? { ...item, readAt: item.readAt ?? now, ...(needsAcknowledgement ? { acknowledgedAt: now } : {}) } : item));
      } catch { return; }
    }
    if (notification.actionUrl) navigate(notification.actionUrl);
  }

  async function readAll() {
    await markAllRead();
    setNotifications(items => items.map(item => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
  }

  return (
    <section className="notifications-page">
      <header className="notifications-page-header">
        <div><h2>Updates that matter</h2><p>Support, account, and platform updates are kept together in one private place.</p></div>
        {unread > 0 && <button className="notifications-read-all" type="button" onClick={() => void readAll()}><Check /> Mark all as read</button>}
      </header>
      <div className="notifications-toolbar" aria-label="Notification filters">
        <span><Funnel /> Filter</span>
        <div>{filters.map(item => <button key={item.value} className={filter === item.value ? "is-active" : ""} type="button" onClick={() => setFilter(item.value)}>{item.label}</button>)}</div>
      </div>
      <NotificationPreferences />
      <div className="notifications-list" aria-live="polite">
        {loading && Array.from({ length: 4 }).map((_, index) => <div className="notification-page-skeleton" key={index}><span /><div><span /><span /></div></div>)}
        {!loading && error && <div className="notifications-empty is-error"><WarningCircle /><h3>Notifications could not be loaded</h3><p>{error}</p><button type="button" onClick={() => void load(true)}>Try again</button></div>}
        {!loading && !error && !notifications.length && <div className="notifications-empty"><Bell /><h3>{filter === "all" ? "No notifications yet" : "Nothing in this view"}</h3><p>{filter === "all" ? "Important support updates will appear here." : "Choose another filter to review previous updates."}</p></div>}
        {!loading && !error && notifications.map(notification => (
          <article className={`notification-page-item priority-${notification.priority}${notification.readAt ? " is-read" : ""}`} key={notification.id}>
            <span className="notification-page-icon">{notification.priority === "critical" ? <WarningCircle weight="fill" /> : <Bell weight="fill" />}</span>
            <div><header><h3>{notification.title}</h3><time dateTime={notification.createdAt}>{fullTime(notification.createdAt)}</time></header><p>{notification.message}</p><span className="notification-priority-label">{notification.priority === "normal" ? "Update" : notification.priority}</span></div>
            <button type="button" onClick={() => void openItem(notification)}>{notification.actionUrl ? "Open" : notification.readAt ? "Read" : "Mark read"}</button>
          </article>
        ))}
      </div>
      {!loading && !error && cursor && <button className="notifications-load-more" type="button" disabled={loadingMore} onClick={() => void load(false)}>{loadingMore ? "Loading updates..." : "Load older notifications"}</button>}
    </section>
  );
}
