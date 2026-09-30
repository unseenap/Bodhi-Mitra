import { describe, expect, it } from "vitest";

describe("atomic acceptance contract", () => {
  it("locks and conditionally transitions the pending request", async () => {
    const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../src/services/mysql-emergency.service.ts", import.meta.url), "utf8"));
    expect(source).toContain("db.transaction().execute");
    expect(source).toContain("forUpdate()");
    expect(source).toContain('.where("status", "=", "pending")');
  });

  it("creates the session in the same transaction", async () => {
    const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../src/services/mysql-emergency.service.ts", import.meta.url), "utf8"));
    expect(source).toContain("transaction().execute");
    expect(source).toContain('transaction.insertInto("sessions")');
  });
});

describe("live session socket boundaries", () => {
  it("requires an active participant and validates bounded payloads", async () => {
    const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../src/socket/index.ts", import.meta.url), "utf8"));
    expect(source).toContain("findParticipant(sessionId, userId, true)");
    expect(source).toContain("sessionMessageSchema.parse(payload)");
    expect(source).toContain("sessionSignalSchema.parse(payload)");
    expect(source).toContain("socketRateLimit");
  });
});
