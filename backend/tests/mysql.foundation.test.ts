import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const schema = () => readFile(new URL("../database/mysql/schema.sql", import.meta.url), "utf8");
const requiredTables = [
  "departments", "users", "student_profiles", "psychologist_profiles",
  "psychologist_specializations", "pending_student_registrations",
  "push_subscriptions", "notification_preferences", "notifications",
  "notification_delivery_attempts", "emergency_requests", "sessions",
  "assessments", "audit_logs", "scheduler_leases", "legacy_mongo_id_map",
];

describe("canonical MySQL schema", () => {
  it("creates every current domain table idempotently", async () => {
    const source = await schema();
    for (const table of requiredTables)
      expect(source).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    expect(source.match(/CREATE TABLE IF NOT EXISTS/g)).toHaveLength(requiredTables.length);
    expect(source).toContain("CREATE OR REPLACE VIEW student_directory");
    expect(source).toContain("CREATE OR REPLACE VIEW psychologist_directory");
    expect(source).toContain("DROP TRIGGER IF EXISTS");
  });

  it("preserves critical concurrency and identity constraints", async () => {
    const source = await schema();
    expect(source).toContain("UNIQUE KEY uq_users_email (email)");
    expect(source).toContain("UNIQUE KEY uq_student_profiles_roll_number (roll_number)");
    expect(source).toContain("UNIQUE KEY uq_one_live_emergency_per_student (live_student_id)");
    expect(source).toContain("UNIQUE KEY uq_sessions_request (request_id)");
    expect(source).toContain("assessment_next_eligible_at <= NEW.completed_at");
    expect(source).toContain("UNIQUE KEY uq_notifications_recipient_dedupe");
  });

  it("bounds sensitive JSON payloads and supports distributed schedulers", async () => {
    const source = await schema();
    expect(source).toContain("JSON_STORAGE_SIZE(subscription) <= 16384");
    expect(source).toContain('\"maxItems\":4');
    expect(source).toContain("PRIMARY KEY (lease_name)");
    expect(source).toContain("KEY ix_scheduler_leases_expiry (expires_at)");
  });
});

describe("MySQL runtime foundation", () => {
  it("parses trigger bodies using MySQL delimiter directives", async () => {
    const { splitMysqlScript } = await import("../src/database/apply-schema.js");
    const statements = splitMysqlScript(await schema());
    expect(statements.length).toBeGreaterThan(25);
    expect(statements.some(statement => statement.includes("CREATE TRIGGER trg_sessions_before_insert"))).toBe(true);
    expect(statements.every(statement => !statement.includes("DELIMITER $$"))).toBe(true);
  });

  it("keeps database credentials out of health and startup errors", async () => {
    const health = await readFile(new URL("../src/database/health.ts", import.meta.url), "utf8");
    const server = await readFile(new URL("../src/server.ts", import.meta.url), "utf8");
    expect(health).not.toContain("error.message");
    expect(server).not.toContain("console.error(\"Database startup failed\", error)");
  });

  it("provides bounded pool and clean shutdown behavior", async () => {
    const config = await readFile(new URL("../src/database/config.ts", import.meta.url), "utf8");
    const client = await readFile(new URL("../src/database/client.ts", import.meta.url), "utf8");
    expect(config).toContain("connectionLimit: env.DATABASE_POOL_MAX");
    expect(config).toContain("connectTimeout: env.DATABASE_CONNECT_TIMEOUT_SECONDS * 1000");
    expect(client).toContain("await active.destroy()");
  });
});
