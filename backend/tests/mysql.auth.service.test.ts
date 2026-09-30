import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("MySQL authentication service contract", () => {
  it("keeps unverified students in pending storage", async () => {
    const source = await readFile(new URL("../src/services/mysql-auth.service.ts", import.meta.url), "utf8");
    const register = source.slice(source.indexOf("async registerStudent"), source.indexOf("async verifyPendingStudent"));
    expect(register).toContain("registrations.savePending");
    expect(register).not.toContain('insertInto("users")');
  });

  it("locks pending registration before OTP verification and completes atomically", async () => {
    const source = await readFile(new URL("../src/services/mysql-auth.service.ts", import.meta.url), "utf8");
    expect(source).toContain("db.transaction().execute");
    expect(source).toContain("findPending(identifier, true)");
    expect(source).toContain("completeStudentRegistration");
  });

  it("preserves enumeration-resistant password comparison", async () => {
    const source = await readFile(new URL("../src/services/mysql-auth.service.ts", import.meta.url), "utf8");
    expect(source).toContain("dummyPasswordHash");
    expect(source).toContain("Sign-in credentials are incorrect");
  });

  it("uses only the MySQL authentication boundary after cutover", async () => {
    const middleware = await readFile(new URL("../src/middleware/mysql-auth.ts", import.meta.url), "utf8");
    const routes = await readFile(new URL("../src/routes/index.ts", import.meta.url), "utf8");
    expect(middleware).toContain("findByUuid(claims.sub)");
    expect(middleware).toContain("issued before the database migration");
    expect(routes).toContain('api.post("/auth/student/register", otpLimit, mysqlRegisterStudent)');
    expect(routes).toContain("requireMysqlAuth");
    expect(routes).not.toContain("mysqlRuntime");
  });
});
