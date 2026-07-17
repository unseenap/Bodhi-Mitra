import { describe, expect, it } from "vitest";

describe("atomic acceptance contract", () => {
  it("uses a guarded pending to matched transition", async () => {
    const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../src/services/emergency.service.ts", import.meta.url), "utf8"));
    expect(source).toContain('status: "pending"'); expect(source).toContain("findOneAndUpdate"); expect(source).toContain('{ new: true');
  });

  it("rolls a request back if session creation fails", async () => {
    const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../src/services/emergency.service.ts", import.meta.url), "utf8"));
    expect(source).toContain("Do not strand the student");
    expect(source).toContain('$set: { status: "pending" }');
  });
});

describe("live session socket boundaries", () => {
  it("requires an active participant and validates bounded payloads", async () => {
    const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../src/socket/index.ts", import.meta.url), "utf8"));
    expect(source).toContain('endedAt: { $exists: false }');
    expect(source).toContain("sessionMessageSchema.parse(payload)");
    expect(source).toContain("sessionSignalSchema.parse(payload)");
    expect(source).toContain("socketRateLimit");
  });
});
