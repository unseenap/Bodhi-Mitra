import type { Database } from "../../database/types.js";
import type { CreatePsychologistInput, ExpertCategory, PsychologistProfile, PsychologistRepository } from "../psychologist.repository.js";
import { RepositoryConflictError, RepositoryNotFoundError } from "../repository.types.js";
import { MysqlRepository, clampLimit } from "./mysql.repository.js";

interface ProfileRow {
  internal_id: string;
  id: string;
  name: string | null;
  email: string;
  professional_title: string;
  expert_category: ExpertCategory;
  portrait_url: string | null;
  verified: boolean;
  is_active: boolean;
  is_online: boolean;
  is_available: boolean;
  created_at: Date;
}

export class MysqlPsychologistRepository extends MysqlRepository implements PsychologistRepository {
  private async hydrate(rows: ProfileRow[]): Promise<PsychologistProfile[]> {
    if (!rows.length) return [];
    const specializations = await this.db.selectFrom("psychologist_specializations")
      .select(["psychologist_id", "specialization"])
      .where("psychologist_id", "in", rows.map(row => row.internal_id))
      .orderBy("position").execute();
    const byPsychologist = new Map<string, string[]>();
    for (const item of specializations) {
      const values = byPsychologist.get(item.psychologist_id) ?? [];
      values.push(item.specialization);
      byPsychologist.set(item.psychologist_id, values);
    }
    return rows.map(row => ({
      id: row.id,
      name: row.name ?? "Bodhi-Mitra psychologist",
      email: row.email,
      professionalTitle: row.professional_title,
      category: row.expert_category,
      specializations: byPsychologist.get(row.internal_id) ?? [],
      portraitUrl: row.portrait_url,
      verified: Boolean(row.verified),
      isActive: Boolean(row.is_active),
      isOnline: Boolean(row.is_online),
      isAvailable: Boolean(row.is_available),
      createdAt: row.created_at,
    }));
  }

  private baseQuery() {
    return this.db.selectFrom("users as u")
      .innerJoin("psychologist_profiles as p", "p.user_id", "u.id")
      .select([
        "u.id as internal_id", "u.user_uuid as id", "u.full_name as name", "u.email",
        "p.professional_title", "p.expert_category", "p.portrait_url",
        "u.verified", "u.is_active", "p.is_online", "p.is_available", "u.created_at",
      ]).where("u.role", "=", "psychologist");
  }

  async list(filters: { category?: ExpertCategory; publicOnly?: boolean; limit?: number } = {}) {
    let query = this.baseQuery();
    if (filters.category) query = query.where("p.expert_category", "=", filters.category);
    if (filters.publicOnly !== false)
      query = query.where("u.verified", "=", true).where("u.is_active", "=", true);
    const rows = await query.orderBy("p.expert_category").orderBy("u.full_name")
      .limit(clampLimit(filters.limit, 100)).execute() as ProfileRow[];
    return this.hydrate(rows);
  }

  async findByUuid(userUuid: string) {
    const row = await this.baseQuery().where("u.user_uuid", "=", userUuid)
      .executeTakeFirst() as ProfileRow | undefined;
    return row ? (await this.hydrate([row]))[0]! : null;
  }

  async create(input: CreatePsychologistInput) {
    try {
      await this.db.transaction().execute(async transaction => {
        const inserted = await transaction.insertInto("users").values({
          user_uuid: input.userUuid,
          role: "psychologist",
          full_name: input.name,
          email: input.email.toLowerCase(),
          password_hash: input.passwordHash,
          otp_hash: null,
          otp_expires_at: null,
          otp_attempts: 0,
          verified: input.verified ?? false,
          is_active: input.isActive ?? true,
          must_change_password: true,
        }).executeTakeFirstOrThrow();
        const userId = String(inserted.insertId);
        await transaction.insertInto("psychologist_profiles").values({
          user_id: userId,
          professional_title: input.professionalTitle,
          expert_category: input.category,
          portrait_url: input.portraitUrl ?? null,
          is_online: false,
          is_available: true,
        }).executeTakeFirstOrThrow();
        if (input.specializations.length)
          await transaction.insertInto("psychologist_specializations").values(
            [...new Set(input.specializations.map(value => value.trim()).filter(Boolean))]
              .map((specialization, position) => ({ psychologist_id: userId, specialization, position })),
          ).executeTakeFirstOrThrow();
      });
    } catch (error) {
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new RepositoryConflictError("Psychologist email already exists");
      throw error;
    }
    const created = await this.findByUuid(input.userUuid);
    if (!created) throw new RepositoryNotFoundError("Psychologist was not created");
    return created;
  }

  async update(userUuid: string, input: Partial<Omit<CreatePsychologistInput, "userUuid">> & { passwordHash?: string }) {
    const existing = await this.db.selectFrom("users as u").innerJoin("psychologist_profiles as p", "p.user_id", "u.id")
      .select("u.id").where("u.user_uuid", "=", userUuid).where("u.role", "=", "psychologist").executeTakeFirst();
    if (!existing) return null;
    await this.db.transaction().execute(async transaction => {
      const userUpdate: Record<string, unknown> = {};
      if (input.name !== undefined) userUpdate.full_name = input.name;
      if (input.email !== undefined) userUpdate.email = input.email.toLowerCase();
      if (input.passwordHash !== undefined) { userUpdate.password_hash = input.passwordHash; userUpdate.must_change_password = true; }
      if (input.verified !== undefined) userUpdate.verified = input.verified;
      if (input.isActive !== undefined) userUpdate.is_active = input.isActive;
      if (Object.keys(userUpdate).length) await transaction.updateTable("users").set(userUpdate as any).where("id", "=", existing.id).executeTakeFirst();
      const profileUpdate: Record<string, unknown> = {};
      if (input.professionalTitle !== undefined) profileUpdate.professional_title = input.professionalTitle;
      if (input.category !== undefined) profileUpdate.expert_category = input.category;
      if (input.portraitUrl !== undefined) profileUpdate.portrait_url = input.portraitUrl;
      if (Object.keys(profileUpdate).length) await transaction.updateTable("psychologist_profiles").set(profileUpdate as any).where("user_id", "=", existing.id).executeTakeFirst();
      if (input.specializations !== undefined) {
        await transaction.deleteFrom("psychologist_specializations").where("psychologist_id", "=", existing.id).execute();
        const values = [...new Set(input.specializations.map(value => value.trim()).filter(Boolean))];
        if (values.length) await transaction.insertInto("psychologist_specializations").values(values.map((specialization, position) => ({ psychologist_id: existing.id, specialization, position }))).execute();
      }
    });
    return this.findByUuid(userUuid);
  }

  async setAvailability(userUuid: string, available: boolean) {
    const result = await this.db.updateTable("psychologist_profiles")
      .set({ is_available: available }).where("user_id", "=", this.db.selectFrom("users").select("id").where("user_uuid", "=", userUuid))
      .executeTakeFirst();
    return result.numUpdatedRows === 1n;
  }

  async setPresence(userUuid: string, online: boolean) {
    const result = await this.db.updateTable("psychologist_profiles")
      .set({ is_online: online }).where("user_id", "=", this.db.selectFrom("users").select("id").where("user_uuid", "=", userUuid))
      .executeTakeFirst();
    return result.numUpdatedRows === 1n;
  }
}
