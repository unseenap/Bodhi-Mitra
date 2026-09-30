import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { clampLimit, parseJson } from "../src/repositories/mysql/mysql.repository.js";

describe("MySQL repository primitives", () => {
  it("bounds list sizes", () => {
    expect(clampLimit(undefined, 20, 50)).toBe(20);
    expect(clampLimit(0, 20, 50)).toBe(1);
    expect(clampLimit(500, 20, 50)).toBe(50);
  });

  it("normalizes MySQL JSON driver values", () => {
    expect(parseJson<{ safe: boolean }>('{"safe":true}')).toEqual({ safe: true });
    expect(parseJson({ safe: true })).toEqual({ safe: true });
  });

  it("provides every planned repository contract and adapter", async () => {
    const contracts = [
      "user", "registration", "psychologist", "emergency", "session",
      "assessment", "audit", "notification", "push-subscription",
    ];
    for (const name of contracts) {
      const contract = await readFile(new URL(`../src/repositories/${name}.repository.ts`, import.meta.url), "utf8");
      const adapter = await readFile(new URL(`../src/repositories/mysql/mysql-${name}.repository.ts`, import.meta.url), "utf8");
      expect(contract).toContain("export interface");
      expect(adapter).toContain("extends MysqlRepository");
      expect(adapter).not.toContain("mongoose");
      expect(adapter).not.toContain("DATABASE_URL");
    }
  });

  it("keeps raw SQL outside domain repositories", async () => {
    const index = await readFile(new URL("../src/repositories/mysql/index.ts", import.meta.url), "utf8");
    expect(index.match(/export \{ Mysql/g)).toHaveLength(9);
    expect(index).not.toContain("sql.raw");
  });
});
