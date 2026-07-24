import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compareIOComponents, compareIOComponentLists } from "../../src/compare/compare-io.js";
import type { IOComponent } from "../../src/models/sensorml/abstract-process.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sweFixtures = join(__dirname, "..", "fixtures", "swe");

function loadComponent(file: string, name: string): IOComponent {
  const json = JSON.parse(readFileSync(join(sweFixtures, file), "utf-8")) as Record<string, unknown>;
  return { ...json, name } as IOComponent;
}

describe("compareIOComponents", () => {
  it("finds a deep uom override inside a Quantity", () => {
    const proc = loadComponent("quantity1.json", "temp");
    const sys = { ...proc, uom: { code: "K" } } as IOComponent;
    const result = compareIOComponents(proc, sys);
    expect(result.entries).toEqual([
      { path: "temp.uom.code", status: "overridden", procedureValue: "Cel", systemValue: "K" },
    ]);
  });

  it("recurses into DataRecord fields by name", () => {
    const proc = loadComponent("record2.json", "distortion");
    const sysJson = JSON.parse(JSON.stringify(proc)) as typeof proc & {
      fields: { name: string; value: number; uom: { code: string } }[];
    };
    sysJson.fields[0]!.value = 2e-5;
    sysJson.fields = sysJson.fields.filter((f) => f.name !== "k3");
    const result = compareIOComponents(proc, sysJson as IOComponent);
    expect(result.overridden).toEqual([
      { path: "distortion.fields.k1.value", status: "overridden", procedureValue: 1.92709e-5, systemValue: 2e-5 },
    ]);
    expect(result.removed.map((e) => e.path)).toEqual(["distortion.fields.k3"]);
  });

  it("reports a single override when the component kind differs (ObservableProperty vs Quantity)", () => {
    const proc = {
      name: "temp",
      type: "ObservableProperty",
      definition: "http://qudt.org/vocab/quantitykind/Temperature",
    } as IOComponent;
    const sys = loadComponent("quantity1.json", "temp");
    const result = compareIOComponents(proc, sys);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({ path: "temp", status: "overridden" });
  });

  it("excludes the name slot from the content diff and honors basePath", () => {
    const proc = loadComponent("quantity1.json", "temp");
    const sys = loadComponent("quantity1.json", "temperature");
    const result = compareIOComponents(proc, sys, { basePath: "outputs.temp", includeUnchanged: true });
    expect(result.entries.every((e) => e.status === "unchanged")).toBe(true);
    expect(result.entries.every((e) => e.path.startsWith("outputs.temp."))).toBe(true);
  });
});

describe("compareIOComponentLists", () => {
  const temp = loadComponent("quantity1.json", "temp");
  const distortion = loadComponent("record2.json", "distortion");

  it("matches by name across the lists", () => {
    const sysTemp = { ...temp, uom: { code: "K" } } as IOComponent;
    const result = compareIOComponentLists([temp, distortion], [sysTemp, distortion], "outputs");
    expect(result.entries).toEqual([
      { path: "outputs.temp.uom.code", status: "overridden", procedureValue: "Cel", systemValue: "K" },
    ]);
  });

  it("treats an absent list as empty, reporting each component individually", () => {
    const added = compareIOComponentLists(undefined, [temp, distortion], "outputs");
    expect(added.added.map((e) => e.path).sort()).toEqual(["outputs.distortion", "outputs.temp"]);
    expect(added.overridden).toEqual([]);

    const removed = compareIOComponentLists([temp], undefined, "parameters");
    expect(removed.removed.map((e) => e.path)).toEqual(["parameters.temp"]);
  });

  it("returns an empty result for two absent lists", () => {
    expect(compareIOComponentLists(undefined, undefined, "inputs").entries).toEqual([]);
  });
});
