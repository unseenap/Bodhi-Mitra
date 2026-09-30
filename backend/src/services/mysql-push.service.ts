import { MysqlPushSubscriptionRepository } from "../repositories/mysql/index.js";
import type { PushSubscriptionPayload } from "../repositories/push-subscription.repository.js";
import webpush from "web-push";
import { env } from "../config/env.js";

const subscriptions = new MysqlPushSubscriptionRepository();
const enabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
if (enabled) webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);

export const saveMysqlSubscription = (userUuid: string, value: PushSubscriptionPayload) =>
  subscriptions.save(userUuid, value);

export const listMysqlSubscriptions = (userUuid: string) =>
  subscriptions.list(userUuid);

export const removeMysqlSubscription = (userUuid: string, endpoint: string) =>
  subscriptions.remove(userUuid, endpoint);

export async function sendMysqlPushToUser(userUuid: string, payload: { title: string; body: string; url: string; tag: string }) {
  if (!enabled) return;
  const values = await subscriptions.list(userUuid);
  await Promise.allSettled(values.map(async subscription => {
    try { await webpush.sendNotification(subscription, JSON.stringify(payload)); }
    catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) await subscriptions.remove(userUuid, subscription.endpoint);
      else throw error;
    }
  }));
}
