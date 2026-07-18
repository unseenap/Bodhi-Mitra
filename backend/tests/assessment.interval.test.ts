import { describe, expect, it } from "vitest";
import { ASSESSMENT_INTERVAL_MS, nextEligibleFrom } from "../src/controllers/assessment.controller.js";

describe("weekly assessment eligibility", () => {
  it("unlocks exactly seven days after completion", () => {
    const completedAt = new Date("2026-07-18T10:00:00.000Z");
    const nextEligibleAt = nextEligibleFrom(completedAt);
    expect(nextEligibleAt.getTime() - completedAt.getTime()).toBe(ASSESSMENT_INTERVAL_MS);
    expect(nextEligibleAt.toISOString()).toBe("2026-07-25T10:00:00.000Z");
  });

  it("uses a 168-hour rolling interval", () => {
    expect(ASSESSMENT_INTERVAL_MS).toBe(168 * 60 * 60 * 1000);
  });
});
