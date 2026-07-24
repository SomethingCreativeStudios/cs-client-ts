import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SmlProcedureSchema } from "../../src/models/sensorml/sml-procedure.js";
import { SmlSystemSchema } from "../../src/models/sensorml/sml-system.js";
import { procedureFromSml } from "../../src/codec/procedure-codec.js";
import { systemFromSml } from "../../src/codec/system-codec.js";
import { compareSystemToProcedure } from "../../src/compare/compare-system.js";
import type { Procedure } from "../../src/models/resources/procedure.js";
import type { System } from "../../src/models/resources/system.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = join(__dirname, "..", "fixtures", "compare");

function load(file: string): unknown {
  return JSON.parse(readFileSync(join(fixtures, file), "utf-8"));
}

function loadPair(): { procedure: Procedure; system: System } {
  const procedure = procedureFromSml(SmlProcedureSchema.parse(load("procedure_tp60s.json")));
  const system = systemFromSml(SmlSystemSchema.parse(load("system_tp60s_instance.json")));
  return { procedure, system };
}

describe("compareSystemToProcedure", () => {
  const { procedure, system } = loadPair();
  const result = compareSystemToProcedure(procedure, system);

  it("reports the full set of overrides and nothing else", () => {
    expect(result.entries.map((e) => `${e.status} ${e.path}`).sort()).toEqual(
      [
        "overridden label",
        "overridden outputs.temp",
        "overridden outputs.weather.fields.pressure.uom.code",
        "overridden parameters.gain.value",
        'added identifiers["http://sensorml.com/ont/swe/property/SerialNumber"]',
        "added outputs.humidity",
        "removed parameters.samplingRate",
      ].sort(),
    );
  });

  it("finds the deep uom override with both values", () => {
    expect(result.overridden).toContainEqual({
      path: "outputs.weather.fields.pressure.uom.code",
      status: "overridden",
      procedureValue: "hPa",
      systemValue: "mbar",
    });
  });

  it("reports the ObservableProperty → Quantity output as a single override", () => {
    const temp = result.overridden.find((e) => e.path === "outputs.temp");
    expect(temp).toBeDefined();
    expect((temp?.procedureValue as { type: string }).type).toBe("ObservableProperty");
    expect((temp?.systemValue as { type: string }).type).toBe("Quantity");
    expect(result.entries.some((e) => e.path.startsWith("outputs.temp."))).toBe(false);
  });

  it("reports an added output as a single whole-component entry", () => {
    const humidity = result.added.find((e) => e.path === "outputs.humidity");
    expect((humidity?.systemValue as { uom: { code: string } }).uom.code).toBe("%");
  });

  it("excludes identity fields, instance fields and typeOf by default", () => {
    const paths = result.entries.map((e) => e.path);
    for (const excluded of ["uniqueId", "featureType", "typeOf", "position", "raw", "sourceEncoding", "id"]) {
      expect(paths.some((p) => p === excluded || p.startsWith(excluded + ".")), excluded).toBe(false);
    }
  });

  it("compares uniqueId with includeIdentity", () => {
    const withIdentity = compareSystemToProcedure(procedure, system, { includeIdentity: true });
    expect(withIdentity.overridden).toContainEqual({
      path: "uniqueId",
      status: "overridden",
      procedureValue: "urn:x-myorg:datasheets:ThermoPro:TP60S:v001",
      systemValue: "urn:x-org:systems:tp60s:001",
    });
  });

  it("reports position as added with includeInstanceFields", () => {
    const withInstance = compareSystemToProcedure(procedure, system, { includeInstanceFields: true });
    const position = withInstance.added.find((e) => e.path === "position");
    expect((position?.systemValue as { type: string }).type).toBe("Point");
    expect(result.added.some((e) => e.path === "position")).toBe(false);
  });

  it("honors ignorePaths", () => {
    const ignoring = compareSystemToProcedure(procedure, system, { ignorePaths: ["outputs", "parameters"] });
    expect(ignoring.entries.map((e) => e.path).sort()).toEqual([
      'identifiers["http://sensorml.com/ont/swe/property/SerialNumber"]',
      "label",
    ]);
  });

  it("returns an empty result when the system restates the procedure verbatim", () => {
    const clone = loadPair();
    const identical = compareSystemToProcedure(clone.procedure, {
      ...clone.system,
      label: clone.procedure.label,
      identifiers: clone.procedure.identifiers,
      outputs: clone.procedure.outputs,
      parameters: clone.procedure.parameters,
    });
    expect(identical.entries).toEqual([]);
  });

  it("emits unchanged entries with includeUnchanged", () => {
    const withUnchanged = compareSystemToProcedure(procedure, system, { includeUnchanged: true });
    expect(withUnchanged.unchanged.map((e) => e.path)).toContain("description");
    expect(withUnchanged.unchanged.map((e) => e.path)).toContain("outputs.weather.fields.dewPoint.uom.code");
  });
});
