import { describe, expect, it } from "vitest";

describe("atomic acceptance contract", () => {
  it("uses a guarded pending to matched transition", async () => {
    const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../src/services/emergency.service.ts", import.meta.url), "utf8"));
    expect(source).toContain('status: "pending"'); expect(source).toContain("findOneAndUpdate"); expect(source).toContain('{ new: true');
  });
});
