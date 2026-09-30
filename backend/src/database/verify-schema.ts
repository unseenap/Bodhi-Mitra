import { sql } from "kysely";
import { destroyMysql, initializeMysql } from "./client.js";
import { mysqlIsConfigured, safeDatabaseTarget } from "./config.js";

const requiredTables = [
  "departments", "users", "student_profiles", "psychologist_profiles",
  "psychologist_specializations", "pending_student_registrations",
  "push_subscriptions", "notification_preferences", "notifications",
  "notification_delivery_attempts", "emergency_requests", "sessions",
  "assessments", "audit_logs", "scheduler_leases", "legacy_mongo_id_map",
] as const;
const requiredViews = ["student_directory", "psychologist_directory"] as const;
const requiredTriggers = [
  "trg_users_before_update", "trg_student_profiles_before_insert",
  "trg_student_profiles_before_update", "trg_psychologist_profiles_before_insert",
  "trg_psychologist_profiles_before_update", "trg_emergency_requests_before_insert",
  "trg_emergency_requests_before_update", "trg_sessions_before_insert",
  "trg_sessions_before_update", "trg_assessments_before_insert",
  "trg_assessments_before_update",
] as const;

async function verifySchema() {
  if (!mysqlIsConfigured()) throw new Error("DATABASE_URL is required for schema verification");
  const db = await initializeMysql();
  const tables = await sql<{ name: string }>`
    SELECT table_name AS name FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
  `.execute(db);
  const views = await sql<{ name: string }>`
    SELECT table_name AS name FROM information_schema.views
    WHERE table_schema = DATABASE()
  `.execute(db);
  const triggers = await sql<{ name: string }>`
    SELECT trigger_name AS name FROM information_schema.triggers
    WHERE trigger_schema = DATABASE()
  `.execute(db);

  const names = (rows: readonly { name: string }[]) => new Set(rows.map(row => row.name));
  const missing = [
    ...requiredTables.filter(name => !names(tables.rows).has(name)),
    ...requiredViews.filter(name => !names(views.rows).has(name)),
    ...requiredTriggers.filter(name => !names(triggers.rows).has(name)),
  ];
  if (missing.length) throw new Error(`Schema is incomplete; missing: ${missing.join(", ")}`);
  await sql`SELECT 1 AS ok`.execute(db);
  console.info(
    `MySQL schema verified at ${safeDatabaseTarget()}: ${requiredTables.length} tables, ${requiredViews.length} views, ${requiredTriggers.length} triggers`,
  );
}

verifySchema()
  .catch(error => {
    console.error(error instanceof Error ? error.message : "Schema verification failed");
    process.exitCode = 1;
  })
  .finally(() => destroyMysql());
