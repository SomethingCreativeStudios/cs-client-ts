import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SmlProcedureSchema } from "../../src/models/sensorml/sml-procedure.js";
import { SmlSystemSchema } from "../../src/models/sensorml/sml-system.js";
import { procedureFromSml } from "../../src/codec/procedure-codec.js";
import { systemFromSml } from "../../src/codec/system-codec.js";
import { compareSystemToInheritedProcedure, procedureIdFromTypeOf } from "../../src/compare/resolve.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = join(__dirname, "..", "fixtures", "compare");

function load(file: string): unknown {
  return JSON.parse(readFileSync(join(fixtures, file), "utf-8"));
}

describe("procedureIdFromTypeOf", () => {
  it("takes the segment after 'procedures', ignoring query and fragment", () => {
    expect(procedureIdFromTypeOf({ href: "https://data.example.org/api/procedures/TP60S?f=sml" })).toBe("TP60S");
    expect(procedureIdFromTypeOf({ href: "https://data.example.org/api/procedures/TP60S#frag" })).toBe("TP60S");
    expect(procedureIdFromTypeOf({ href: "/api/procedures/TP60S/" })).toBe("TP60S");
  });

  it("falls back to the last path segment", () => {
    expect(procedureIdFromTypeOf({ href: "https://example.org/datasheets/TP60S" })).toBe("TP60S");
    expect(procedureIdFromTypeOf({ href: "TP60S" })).toBe("TP60S");
  });

  it("returns undefined for hrefs without a usable path", () => {
    expect(procedureIdFromTypeOf({ href: "https://example.org/" })).toBeUndefined();
    expect(procedureIdFromTypeOf({ href: "" })).toBeUndefined();
  });
});

describe("compareSystemToInheritedProcedure", () => {
  const procedure = procedureFromSml(SmlProcedureSchema.parse(load("procedure_tp60s.json")));
  const system = systemFromSml(SmlSystemSchema.parse(load("system_tp60s_instance.json")));

  it("resolves the procedure id from typeOf, fetches it and compares", async () => {
    const get = vi.fn().mockResolvedValue(procedure);
    const result = await compareSystemToInheritedProcedure({ procedures: { get } }, system);
    expect(get).toHaveBeenCalledWith("TP60S");
    expect(result.procedure).toBe(procedure);
    expect(result.overridden.map((e) => e.path)).toContain("outputs.weather.fields.pressure.uom.code");
  });

  it("throws when the system has no typeOf", async () => {
    const get = vi.fn();
    await expect(
      compareSystemToInheritedProcedure({ procedures: { get } }, { ...system, typeOf: undefined }),
    ).rejects.toThrow(/no typeOf link/);
    expect(get).not.toHaveBeenCalled();
  });

  it("mentions the uid when the href yields no id", async () => {
    const broken = { ...system, typeOf: { href: "https://example.org/", uid: "urn:x-myorg:datasheets:TP60S" } };
    await expect(compareSystemToInheritedProcedure({ procedures: { get: vi.fn() } }, broken)).rejects.toThrow(
      /urn:x-myorg:datasheets:TP60S/,
    );
  });
});
