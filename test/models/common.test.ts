import { describe, expect, it } from "vitest";
import { TimePeriodSchema } from "../../src/models/common/time.js";

describe("TimePeriodSchema", () => {
  it("normalizes null or omitted open bounds from live CS API responses", () => {
    expect(TimePeriodSchema.parse([null])).toEqual(["..", ".."]);
    expect(TimePeriodSchema.parse(["2026-07-05T00:00:00Z"])).toEqual(["2026-07-05T00:00:00Z", ".."]);
    expect(TimePeriodSchema.parse([null, "now"])).toEqual(["..", "now"]);
  });
});
