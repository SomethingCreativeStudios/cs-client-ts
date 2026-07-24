import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { IOComponent } from "../../src/models/sensorml/abstract-process.js";
import { walkComponentPathRefs } from "../../src/path-ref/walk-component.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sweFixtures = join(__dirname, "..", "fixtures", "swe");

function loadComponent(file: string, name: string): IOComponent {
  const json = JSON.parse(readFileSync(join(sweFixtures, file), "utf-8")) as Record<string, unknown>;
  return { ...json, name } as IOComponent;
}

describe("walkComponentPathRefs", () => {
  it("emits the DataRecord container then each field, with chained labels", () => {
    const parts = walkComponentPathRefs("parameters", loadComponent("record2.json", "calibration"));
    expect(parts.map((p) => p.ref)).toEqual([
      "parameters/calibration",
      "parameters/calibration/k1",
      "parameters/calibration/k2",
      "parameters/calibration/k3",
    ]);
    expect(parts[0]).toMatchObject({
      prefix: "parameters",
      segments: ["calibration"],
      componentType: "DataRecord",
      targets: ["setStatus"],
      valid: true,
    });
    expect(parts[1]).toMatchObject({
      label: "Radial Distortion Coefficients / Coef k1",
      componentType: "Quantity",
      targets: ["setValues", "setConstraints", "setStatus"],
    });
  });

  it("walks Vector coordinates as scalar leaves", () => {
    const parts = walkComponentPathRefs("outputs", loadComponent("vector1.json", "location"));
    expect(parts.map((p) => p.ref)).toEqual(["outputs/location", "outputs/location/lat", "outputs/location/lon"]);
    expect(parts[0]?.targets).toEqual(["setStatus"]);
    expect(parts[1]?.targets).toContain("setValues");
  });

  it("recurses through a DataArray's elementType slot", () => {
    const parts = walkComponentPathRefs("parameters", loadComponent("array1.json", "calTable"));
    expect(parts.map((p) => p.ref)).toEqual([
      "parameters/calTable",
      "parameters/calTable/point",
      "parameters/calTable/point/t",
      "parameters/calTable/point/r",
    ]);
    expect(parts[0]?.targets).toEqual(["setArrayValues", "setStatus"]);
    expect(parts[2]?.label).toBe("Calibration Table / Data Point / Temperature");
  });

  it("walks DataChoice items and their nested fields", () => {
    const refs = walkComponentPathRefs("outputs", loadComponent("choice1.json", "message")).map((p) => p.ref);
    expect(refs).toEqual([
      "outputs/message",
      "outputs/message/TEMP",
      "outputs/message/TEMP/time",
      "outputs/message/TEMP/temp",
      "outputs/message/PRESS",
      "outputs/message/PRESS/time",
      "outputs/message/PRESS/press",
    ]);
  });

  it("classifies ranges as array-shaped and Boolean as unconstrainable", () => {
    const range = walkComponentPathRefs("parameters", loadComponent("quantity-range1.json", "span"));
    expect(range).toHaveLength(1);
    expect(range[0]?.targets).toEqual(["setArrayValues", "setConstraints", "setStatus"]);

    const bool = walkComponentPathRefs("parameters", loadComponent("boolean1.json", "active"));
    expect(bool[0]?.targets).toEqual(["setValues", "setStatus"]);
  });

  it("treats an href-only slot as a leaf with no componentType", () => {
    const parts = walkComponentPathRefs("inputs", { name: "linked", href: "https://example.org/def" } as never);
    expect(parts).toEqual([
      {
        ref: "inputs/linked",
        label: "linked",
        prefix: "inputs",
        segments: ["linked"],
        componentType: undefined,
        targets: ["setStatus"],
        valid: true,
      },
    ]);
  });

  it("keeps raw invalid names and flags them, propagating to descendants", () => {
    const record = {
      name: "my record",
      type: "DataRecord",
      fields: [{ name: "ok", type: "Quantity", uom: { code: "1" } }],
    } as never;
    const parts = walkComponentPathRefs("parameters", record);
    expect(parts.map((p) => [p.ref, p.valid])).toEqual([
      ["parameters/my record", false],
      ["parameters/my record/ok", false],
    ]);
  });

  it("prepends baseSegments and baseLabel", () => {
    const parts = walkComponentPathRefs("components", loadComponent("record2.json", "calibration"), {
      baseSegments: ["detector", "parameters"],
      baseLabel: "Detector",
    });
    expect(parts[0]?.ref).toBe("components/detector/parameters/calibration");
    expect(parts[1]?.ref).toBe("components/detector/parameters/calibration/k1");
    expect(parts[1]?.label).toBe("Detector / Radial Distortion Coefficients / Coef k1");
  });

  it("stops at maxDepth and survives cycles", () => {
    const parts = walkComponentPathRefs("parameters", loadComponent("array1.json", "calTable"), { maxDepth: 2 });
    expect(parts.map((p) => p.ref)).toEqual(["parameters/calTable", "parameters/calTable/point"]);

    const cyclic: Record<string, unknown> = { name: "loop", type: "DataRecord" };
    cyclic.fields = [cyclic];
    const cycleParts = walkComponentPathRefs("parameters", cyclic as never);
    expect(cycleParts.length).toBeLessThanOrEqual(2);
  });
});
