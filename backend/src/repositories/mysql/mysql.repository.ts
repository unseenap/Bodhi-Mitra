import { getMysqlDatabase } from "../../database/client.js";
import type { DatabaseExecutor } from "../repository.types.js";

export abstract class MysqlRepository {
  constructor(protected readonly db: DatabaseExecutor = getMysqlDatabase()) {}
}

export function clampLimit(value: number | undefined, fallback = 50, maximum = 200) {
  return Math.max(1, Math.min(maximum, value ?? fallback));
}

export function parseJson<T>(value: T | string): T {
  return typeof value === "string" ? JSON.parse(value) as T : value;
}
