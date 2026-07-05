import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { toCamelKeys, toWireKeys, WIRE_TO_CAMEL } from "../../src/codec/keys.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesRoot = join(__dirname, "..", "fixtures");

function walkJsonFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walkJsonFiles(full));
    else if (entry.endsWith(".json")) out.push(full);
  }
  return out;
}

describe("toCamelKeys / toWireKeys", () => {
  it("round-trips every known wire key", () => {
    for (const wireKey of Object.keys(WIRE_TO_CAMEL)) {
      const camelled = toCamelKeys<Record<string, unknown>>({ [wireKey]: 1 });
      const back = toWireKeys<Record<string, unknown>>(camelled);
      expect(back).toEqual({ [wireKey]: 1 });
    }
  });

  it("leaves unrelated keys untouched", () => {
    const input = { id: "1", name: "foo", resultLink: "should not collide" };
    expect(toCamelKeys(input)).toEqual(input);
  });

  it("round-trips (shallowly) every fixture's top level that contains a known wire key", () => {
    for (const file of walkJsonFiles(fixturesRoot)) {
      const json = JSON.parse(readFileSync(file, "utf-8"));
      if (json === null || typeof json !== "object" || Array.isArray(json)) continue;
      const hasWireKey = Object.keys(json).some((k) => k in WIRE_TO_CAMEL);
      if (!hasWireKey) continue;
      const camelled = toCamelKeys<Record<string, unknown>>(json);
      const back = toWireKeys<Record<string, unknown>>(camelled);
      expect(back, file).toEqual(json);
    }
  });

  it("throws on a mapping collision", () => {
    expect(() => toCamelKeys({ "system@link": 1, systemLink: 2 })).toThrow(/collision/);
  });
});
