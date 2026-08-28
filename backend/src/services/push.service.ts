import webpush from "web-push";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
const enabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
if (enabled) webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
type PushSubscription = { endpoint: string; expirationTime?: number | null; keys: { p256dh: string; auth: string } };
type PushPayload = { title: string; body: string; url: string; tag: string };

export async function saveSubscription(userId: string, subscription: PushSubscription) {
  await User.findByIdAndUpdate(userId, { $pull: { pushSubscriptions: { endpoint: subscription.endpoint } } });
  await User.findByIdAndUpdate(userId, { $addToSet: { pushSubscriptions: subscription } });
}

export async function removeSubscription(userId: string, endpoint: string) {
  await User.findByIdAndUpdate(userId, { $pull: { pushSubscriptions: { endpoint } } });
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!enabled) return;
  const user = await User.findById(userId).select("+pushSubscriptions");
  if (!user) return;
  await Promise.allSettled((user.pushSubscriptions ?? []).map(async (subscription: any) => {
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) await removeSubscription(userId, subscription.endpoint);
      else throw error;
    }
  }));
}

export async function notifyPsychologists(payload: { requestId: string; mode: string }) {
  if (!enabled) return;
  const users = await User.find({ role: "psychologist", verified: true, isActive: true, isAvailable: true }).select("_id");
  await Promise.allSettled(users.map(user => sendPushToUser(String(user._id), {
    title: "New support request",
    body: `A student is waiting for ${payload.mode} support.`,
    url: "/psychologist",
    tag: payload.requestId
  })));
}
