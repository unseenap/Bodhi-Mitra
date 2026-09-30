import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { sql } from "kysely";
import { destroyMysql, initializeMysql } from "./client.js";
import { mysqlIsConfigured, safeDatabaseTarget } from "./config.js";

export function splitMysqlScript(source: string): string[] {
  const statements: string[] = [];
  let delimiter = ";";
  let buffer = "";
  for (const line of source.split(/\r?\n/)) {
    const directive = line.trim().match(/^DELIMITER\s+(.+)$/i);
    if (directive) {
      const hasSql = buffer
        .split(/\r?\n/)
        .some(bufferLine => bufferLine.trim() && !bufferLine.trim().startsWith("--"));
      if (hasSql) throw new Error("DELIMITER changed inside an unfinished statement");
      buffer = "";
      delimiter = directive[1]!;
      continue;
    }
    buffer += `${line}\n`;
    if (buffer.trimEnd().endsWith(delimiter)) {
      const end = buffer.lastIndexOf(delimiter);
      const statement = buffer.slice(0, end).trim();
      if (statement) statements.push(statement);
      buffer = "";
    }
  }
  if (buffer.trim()) throw new Error("Schema contains an unfinished SQL statement");
  return statements;
}

async function applySchema() {
  if (!mysqlIsConfigured()) throw new Error("DATABASE_URL is required to apply the schema");
  if (process.env.MYSQL_SCHEMA_APPLY_CONFIRM !== "bodhi_mitra")
    throw new Error("Set MYSQL_SCHEMA_APPLY_CONFIRM=bodhi_mitra for this explicit schema operation");

  const db = await initializeMysql();
  const selected = await sql<{ databaseName: string | null }>`
    SELECT DATABASE() AS databaseName
  `.execute(db);
  if (!selected.rows[0]?.databaseName)
    throw new Error("DATABASE_URL must select a database");

  const source = await readFile(
    new URL("../../database/mysql/schema.sql", import.meta.url),
    "utf8",
  );
  const statements = splitMysqlScript(source);
  for (const statement of statements) {
    try { await sql.raw(statement).execute(db); }
    catch (error) {
      // MySQL versions before 8.0.29 do not support ADD COLUMN IF NOT EXISTS.
      // The schema remains replayable by accepting only the known duplicate-column code.
      if ((error as { code?: string }).code !== "ER_DUP_FIELDNAME") throw error;
    }
  }
  console.info(`Applied ${statements.length} schema statements to ${safeDatabaseTarget()}`);
}

const isCommandEntryPoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;
if (isCommandEntryPoint) {
  applySchema()
    .catch(error => {
      console.error(error instanceof Error ? error.message : "Schema application failed");
      process.exitCode = 1;
    })
    .finally(() => destroyMysql());
}
