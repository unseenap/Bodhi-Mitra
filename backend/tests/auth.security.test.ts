import { describe, expect, it } from "vitest";
import { makeOtp, signToken, verifyToken } from "../src/utils/auth.js";

describe("authentication security primitives", () => {
  it("creates cryptographically generated six-digit OTP values", () => {
    const values = Array.from({ length: 250 }, () => makeOtp());
    expect(values.every((value) => /^\d{6}$/.test(value))).toBe(true);
    expect(new Set(values).size).toBeGreaterThan(240);
  });

  it("signs role-bound tokens that verify without exposing extra user data", () => {
    const token = signToken("507f1f77bcf86cd799439011", "student");
    const claims = verifyToken(token);
    expect(claims.sub).toBe("507f1f77bcf86cd799439011");
    expect(claims.role).toBe("student");
    expect(token).not.toContain("507f1f77bcf86cd799439011");
  });
});
