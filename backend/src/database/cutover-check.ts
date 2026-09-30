import { sql } from "kysely";
import { destroyMysql, initializeMysql } from "./client.js";
import { safeDatabaseTarget } from "./config.js";

const EXPECTED_TABLES = 16;

async function scalar(query: ReturnType<typeof sql<{ count: string | number }>>) {
  const result = await query.execute(await initializeMysql());
  return Number(result.rows[0]?.count ?? 0);
}

async function main() {
  const db = await initializeMysql();
  const [tables, orphanProfiles, orphanSessions, duplicateEmails, duplicateRolls] = await Promise.all([
    scalar(sql<{ count: string | number }>`SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`),
    scalar(sql<{ count: string | number }>`SELECT COUNT(*) AS count FROM student_profiles p LEFT JOIN users u ON u.id = p.user_id WHERE u.id IS NULL`),
    scalar(sql<{ count: string | number }>`SELECT COUNT(*) AS count FROM sessions s LEFT JOIN users student ON student.id = s.student_id LEFT JOIN users psychologist ON psychologist.id = s.psychologist_id WHERE student.id IS NULL OR psychologist.id IS NULL`),
    scalar(sql<{ count: string | number }>`SELECT COUNT(*) AS count FROM (SELECT email FROM users GROUP BY email HAVING COUNT(*) > 1) duplicates`),
    scalar(sql<{ count: string | number }>`SELECT COUNT(*) AS count FROM (SELECT roll_number FROM student_profiles GROUP BY roll_number HAVING COUNT(*) > 1) duplicates`),
  ]);

  const checks = {
    expectedTables: tables >= EXPECTED_TABLES,
    noOrphanProfiles: orphanProfiles === 0,
    noOrphanSessions: orphanSessions === 0,
    uniqueEmails: duplicateEmails === 0,
    uniqueRollNumbers: duplicateRolls === 0,
  };
  const ok = Object.values(checks).every(Boolean);
  console.log(JSON.stringify({ ok, target: safeDatabaseTarget(), checks, observed: { tables, orphanProfiles, orphanSessions, duplicateEmails, duplicateRolls } }, null, 2));
  if (!ok) process.exitCode = 1;
  await db.selectFrom("departments").select("id").limit(1).execute();
}

try {
  await main();
} catch {
  console.error("MySQL cutover check failed without exposing database credentials");
  process.exitCode = 1;
} finally {
  await destroyMysql();
}
