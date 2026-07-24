import { describe, expect, it } from "vitest";
import {
  composePathRef,
  isPathRef,
  parsePathRef,
  pathRefPrefixes,
  sanitizePathRefSegment,
  SEGMENT_PATTERN,
} from "../../src/path-ref/strings.js";

describe("isPathRef", () => {
  it("accepts prefixed multi-segment refs and trims whitespace", () => {
    expect(isPathRef("parameters/gain")).toBe(true);
    expect(isPathRef("components/detector/parameters/calibration/gain")).toBe(true);
    expect(isPathRef("  modes/OPERATING_MODES  ")).toBe(true);
  });

  it("rejects bad prefixes and bad segments", () => {
    expect(isPathRef("gain")).toBe(false);
    expect(isPathRef("settings/gain")).toBe(false);
    expect(isPathRef("parameters/3sigma")).toBe(false);
    expect(isPathRef("parameters/my gain")).toBe(false);
    expect(isPathRef("parameters/")).toBe(false);
  });
});

describe("parsePathRef", () => {
  it("splits at the first slash", () => {
    expect(parsePathRef("outputs/weather/pressure")).toEqual({ prefix: "outputs", path: "weather/pressure" });
  });

  it("falls back to parameters for unknown prefixes and bare paths", () => {
    expect(parsePathRef("gain")).toEqual({ prefix: "parameters", path: "gain" });
    expect(parsePathRef("settings/gain")).toEqual({ prefix: "parameters", path: "settings/gain" });
  });
});

describe("composePathRef", () => {
  it("joins prefix and path, trimming surrounding slashes", () => {
    expect(composePathRef("parameters", "gain")).toBe("parameters/gain");
    expect(composePathRef("outputs", "/weather/pressure/")).toBe("outputs/weather/pressure");
  });
});

describe("sanitizePathRefSegment", () => {
  it("normalizes arbitrary text into a valid segment", () => {
    expect(sanitizePathRefSegment("My Sensor #2")).toBe("My_Sensor_2");
    expect(sanitizePathRefSegment("")).toBe("item");
    expect(sanitizePathRefSegment("3sigma")).toBe("item_3sigma");
    expect(SEGMENT_PATTERN.test(sanitizePathRefSegment("--weird--input--"))).toBe(true);
  });
});

describe("pathRefPrefixes", () => {
  it("covers the five scopes in enIto order", () => {
    expect(pathRefPrefixes).toEqual(["components", "inputs", "outputs", "parameters", "modes"]);
  });
});
