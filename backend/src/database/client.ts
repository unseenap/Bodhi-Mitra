import { Kysely, MysqlDialect } from "kysely";
import { createPool, type Pool } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { env } from "../config/env.js";
import { mysqlPoolOptions } from "./config.js";
import type { Database } from "./types.js";

let pool: Pool | undefined;
let database: Kysely<Database> | undefined;
let initialization: Promise<Kysely<Database>> | undefined;

function createDatabase(): Kysely<Database> {
  pool = createPool(mysqlPoolOptions());
  database = new Kysely<Database>({ dialect: new MysqlDialect({ pool }) });
  return database;
}

export function getMysqlDatabase(): Kysely<Database> {
  return database ?? createDatabase();
}

export async function initializeMysql(): Promise<Kysely<Database>> {
  if (initialization) return initialization;
  initialization = (async () => {
    const db = getMysqlDatabase();
    const connections: PoolConnection[] = [];
    try {
      for (let index = 0; index < env.DATABASE_POOL_MIN; index += 1)
        connections.push(await pool!.promise().getConnection());
    } finally {
      connections.forEach(connection => connection.release());
    }
    return db;
  })().catch(error => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}

export async function destroyMysql(): Promise<void> {
  const active = database;
  database = undefined;
  pool = undefined;
  initialization = undefined;
  if (active) await active.destroy();
}
