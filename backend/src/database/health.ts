import { sql } from "kysely";
import { getMysqlDatabase } from "./client.js";
import { mysqlIsConfigured, safeDatabaseTarget } from "./config.js";

export type MysqlHealth =
  | { status: "not_configured" }
  | { status: "ok"; latencyMs: number; target: string | null }
  | { status: "unavailable"; latencyMs: number; target: string | null };

export async function checkMysqlHealth(): Promise<MysqlHealth> {
  if (!mysqlIsConfigured()) return { status: "not_configured" };
  const startedAt = performance.now();
  try {
    await sql<{ ok: number }>`SELECT 1 AS ok`.execute(getMysqlDatabase());
    return {
      status: "ok",
      latencyMs: Math.round(performance.now() - startedAt),
      target: safeDatabaseTarget(),
    };
  } catch {
    return {
      status: "unavailable",
      latencyMs: Math.round(performance.now() - startedAt),
      target: safeDatabaseTarget(),
    };
  }
}
