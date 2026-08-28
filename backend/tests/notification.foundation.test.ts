import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

describe("notification privacy and access boundaries", () => {
  it("scopes notification reads and mutations to the authenticated recipient", async () => {
    const source = await read("../src/controllers/notification.controller.ts");
    expect(source).toContain("recipientId: req.auth!.id");
    expect(source).toContain("recipientRole: req.auth!.role");
    expect(source).not.toContain("req.body.recipientId");
    expect(source).toContain("acknowledgeNotification");
    expect(source).toContain('priority: { $in: ["critical", "high"] }');
  });

  it("rejects external notification action links", async () => {
    const source = await read("../src/services/notification.service.ts");
    expect(source).toContain('value.startsWith("/")');
    expect(source).toContain('value.startsWith("//")');
    expect(source).toContain("Notification action URL must be an internal application path");
  });
});

describe("session notification lifecycle", () => {
  it("tracks confirmed disconnect episodes and reconnects", async () => {
    const source = await read("../src/socket/index.ts");
    expect(source).toContain("joinedPresence");
    expect(source).toContain("disconnectedPresence");
    expect(source).toContain("SESSION_PARTICIPANT_DISCONNECTED");
    expect(source).toContain("SESSION_PARTICIPANT_RECONNECTED");
    expect(source).toContain("session-disconnected:");
    expect(source).toContain("session-reconnected:");
  });

  it("creates call-ready notifications only from psychologist readiness", async () => {
    const source = await read("../src/socket/index.ts");
    expect(source).toContain('role === "psychologist" && session.mode !== "chat"');
    expect(source).toContain("SESSION_CALL_READY");
    expect(source).toContain('type: "session.call.incoming"');
  });
});

describe("notification delivery guarantees", () => {
  it("stores records before socket and push delivery", async () => {
    const source = await read("../src/services/notification.service.ts");
    const insert = source.indexOf("Notification.create");
    const socket = source.indexOf("emitNotification?.");
    const push = source.indexOf("void sendPushToUser");
    expect(insert).toBeGreaterThan(-1);
    expect(socket).toBeGreaterThan(insert);
    expect(push).toBeGreaterThan(insert);
  });

  it("uses recipient-scoped unique deduplication", async () => {
    const source = await read("../src/models/Notification.ts");
    expect(source).toContain("{ recipientId: 1, deduplicationKey: 1 }");
    expect(source).toContain("unique: true");
  });

  it("keeps the weekly reminder job idempotent", async () => {
    const source = await read("../src/services/notification.scheduler.ts");
    expect(source).toContain("assessment-eligible:${eligibleAt.toISOString()}");
    expect(source).toContain("!item.assessmentReminders");
    expect(source).toContain("preference?.push === false");
  });
});
