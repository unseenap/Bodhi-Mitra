import { createHash } from "node:crypto";
import type { PushSubscriptionPayload, PushSubscriptionRepository } from "../push-subscription.repository.js";
import { RepositoryNotFoundError } from "../repository.types.js";
import { MysqlRepository, parseJson } from "./mysql.repository.js";

export class MysqlPushSubscriptionRepository extends MysqlRepository implements PushSubscriptionRepository {
  private async userId(userUuid: string) {
    return (await this.db.selectFrom("users").select("id")
      .where("user_uuid", "=", userUuid).executeTakeFirst())?.id ?? null;
  }

  async save(userUuid: string, subscription: PushSubscriptionPayload) {
    const userId = await this.userId(userUuid);
    if (!userId) throw new RepositoryNotFoundError("Push subscription user not found");
    const endpointHash = createHash("sha256").update(subscription.endpoint).digest();
    await this.db.insertInto("push_subscriptions").values({
      user_id: userId, subscription: JSON.stringify(subscription), endpoint_hash: endpointHash,
    }).onDuplicateKeyUpdate({ subscription: JSON.stringify(subscription) }).executeTakeFirstOrThrow();
  }

  async list(userUuid: string) {
    const userId = await this.userId(userUuid);
    if (!userId) return [];
    const rows = await this.db.selectFrom("push_subscriptions").select("subscription")
      .where("user_id", "=", userId).execute();
    return rows.map(row => parseJson<PushSubscriptionPayload>(row.subscription));
  }

  async remove(userUuid: string, endpoint: string) {
    const userId = await this.userId(userUuid);
    if (!userId) return false;
    const endpointHash = createHash("sha256").update(endpoint).digest();
    const result = await this.db.deleteFrom("push_subscriptions")
      .where("user_id", "=", userId).where("endpoint_hash", "=", endpointHash)
      .executeTakeFirst();
    return result.numDeletedRows === 1n;
  }
}
