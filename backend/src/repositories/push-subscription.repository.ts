export interface PushSubscriptionPayload {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
}

export interface PushSubscriptionRepository {
  save(userUuid: string, subscription: PushSubscriptionPayload): Promise<void>;
  list(userUuid: string): Promise<PushSubscriptionPayload[]>;
  remove(userUuid: string, endpoint: string): Promise<boolean>;
}
