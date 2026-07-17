import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("route architecture", () => {
  it("provides dedicated emergency and quick-connect entry routes", async () => {
    const source = await readFile(new URL("./App.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/path="emergency"\s+element=\{<EmergencyPage\s*\/>\}/);
    expect(source).toMatch(/path="quick-connect"\s+element=\{<QuickConnectPage\s*\/>\}/);
    expect(source).toMatch(/path="change-password"\s+element=\{<ChangePasswordPage\s*\/>\}/);
  });

  it("guards every dashboard by role", async () => {
    const source = await readFile(new URL("./App.tsx", import.meta.url), "utf8");
    expect(source).toContain('ProtectedRoute role="student"');
    expect(source).toContain('ProtectedRoute role="psychologist"');
    expect(source).toContain('ProtectedRoute role="admin"');
  });
});
