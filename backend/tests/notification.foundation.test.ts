import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

describe("notification privacy and access boundaries", () => {
  it("scopes notification reads and mutations to the authenticated recipient", async () => {
    const source = await read("../src/controllers/mysql-notification.controller.ts");
    expect(source).toContain("notifications.list(req.auth!.id, req.auth!.role");
    expect(source).toContain("notifications.markRead(id.parse(req.params.notificationId), req.auth!.id)");
    expect(source).not.toContain("req.body.recipientId");
    expect(source).toContain("notifications.acknowledge");
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
    expect(source.indexOf("emitNotification?.")).toBeGreaterThan(source.indexOf("notifications.create"));
    expect(source.indexOf("void sendMysqlPushToUser")).toBeGreaterThan(source.indexOf("notifications.create"));
  });

  it("uses recipient-scoped unique deduplication", async () => {
    const source = await read("../database/mysql/schema.sql");
    expect(source).toContain("UNIQUE KEY uq_notifications_recipient_dedupe");
    expect(source).toContain("recipient_id, deduplication_key");
  });

  it("keeps the weekly reminder job idempotent", async () => {
    const source = await read("../src/services/notification.scheduler.ts");
    expect(source).toContain("assessment-eligible:${student.assessment_next_eligible_at!.toISOString()}");
    expect(source).toContain("np.assessment_reminders");
    expect(source).toContain("student.push_enabled === false");
    expect(source).toContain("acquireMysqlLease");
  });
});
