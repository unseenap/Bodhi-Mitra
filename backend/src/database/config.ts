import type { PoolOptions } from "mysql2";
import { env } from "../config/env.js";

export class DatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

export function mysqlIsConfigured(): boolean {
  return Boolean(env.DATABASE_URL);
}

export function mysqlPoolOptions(): PoolOptions {
  if (!env.DATABASE_URL)
    throw new DatabaseConfigurationError("MySQL is not configured");

  let parsed: URL;
  try {
    parsed = new URL(env.DATABASE_URL);
  } catch {
    throw new DatabaseConfigurationError("DATABASE_URL is invalid");
  }

  if (!/^mysql2?:$/.test(parsed.protocol) || !parsed.hostname || !parsed.pathname.slice(1))
    throw new DatabaseConfigurationError(
      "DATABASE_URL must identify a MySQL host and database",
    );

  let ssl: PoolOptions["ssl"];
  if (env.DATABASE_SSL === "required") {
    let ca: string | undefined;
    if (env.DATABASE_SSL_CA_BASE64) {
      try {
        ca = Buffer.from(env.DATABASE_SSL_CA_BASE64, "base64").toString("utf8");
        if (!ca.includes("BEGIN CERTIFICATE"))
          throw new Error("Decoded value is not a PEM certificate");
      } catch {
        throw new DatabaseConfigurationError("DATABASE_SSL_CA_BASE64 is invalid");
      }
    }
    ssl = { rejectUnauthorized: true, ...(ca ? { ca } : {}) };
  }

  return {
    uri: env.DATABASE_URL,
    connectionLimit: env.DATABASE_POOL_MAX,
    maxIdle: env.DATABASE_POOL_MAX,
    idleTimeout: 60_000,
    waitForConnections: true,
    queueLimit: 0,
    connectTimeout: env.DATABASE_CONNECT_TIMEOUT_SECONDS * 1000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    supportBigNumbers: true,
    bigNumberStrings: true,
    timezone: "Z",
    charset: "utf8mb4",
    ssl,
  };
}

export function safeDatabaseTarget(): string | null {
  if (!env.DATABASE_URL) return null;
  try {
    const url = new URL(env.DATABASE_URL);
    const port = url.port || "3306";
    return `${url.hostname}:${port}/${url.pathname.slice(1)}`;
  } catch {
    return "invalid-database-url";
  }
}
