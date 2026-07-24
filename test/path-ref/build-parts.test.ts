import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SmlProcedureSchema } from "../../src/models/sensorml/sml-procedure.js";
import { procedureFromSml } from "../../src/codec/procedure-codec.js";
import { buildPathRefParts, type PathRefSource } from "../../src/path-ref/build-parts.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = join(__dirname, "..", "fixtures", "compare", "procedure_tp60s.json");

describe("buildPathRefParts", () => {
  // A Procedure is a first-class source: configuration overrides on a System
  // address the parent procedure's tree.
  const procedure = procedureFromSml(SmlProcedureSchema.parse(JSON.parse(readFileSync(fixture, "utf-8"))));

  it("enumerates the full autosuggest set for a procedure", () => {
    const refs = buildPathRefParts(procedure).map((p) => p.ref);
    expect(refs).toEqual([
      "outputs/temp",
      "outputs/weather",
      "outputs/weather/pressure",
      "outputs/weather/dewPoint",
      "parameters/gain",
      "parameters/offset",
      "parameters/samplingRate",
    ]);
  });

  it("classifies procedure nodes for settings autosuggest", () => {
    const parts = buildPathRefParts(procedure);
    const byRef = new Map(parts.map((p) => [p.ref, p]));
    expect(byRef.get("outputs/temp")).toMatchObject({ componentType: "ObservableProperty", targets: ["setStatus"] });
    expect(byRef.get("outputs/weather/pressure")?.targets).toEqual(["setValues", "setConstraints", "setStatus"]);
    expect(byRef.get("parameters/gain")?.valid).toBe(true);
  });

  it("filters by settings kind", () => {
    const refs = buildPathRefParts(procedure, { kinds: ["setValues"] }).map((p) => p.ref);
    expect(refs).toEqual([
      "outputs/weather/pressure",
      "outputs/weather/dewPoint",
      "parameters/gain",
      "parameters/offset",
      "parameters/samplingRate",
    ]);
  });

  it("recurses into inline sub-processes under components, but not into links", () => {
    const source: PathRefSource = {
      components: [
        {
          name: "detector",
          type: "PhysicalComponent",
          label: "Detector",
          parameters: [
            { name: "gain", type: "Quantity", label: "Gain", uom: { code: "1" } },
          ],
          modes: [{ label: "FAST" }],
          components: [{ name: "adc", type: "SimpleProcess" }],
        },
        { name: "remote", type: "Link", href: "https://example.org/systems/remote" },
      ],
    } as never;
    const refs = buildPathRefParts(source).map((p) => p.ref);
    expect(refs).toEqual([
      "components/detector",
      "components/detector/parameters/gain",
      "components/detector/modes/FAST",
      "components/detector/components/adc",
      "components/remote",
    ]);
    const parts = buildPathRefParts(source);
    expect(parts.find((p) => p.ref === "components/detector/parameters/gain")?.label).toBe("Detector / Gain");
    expect(parts.find((p) => p.ref === "components/detector/modes/FAST")?.targets).toEqual(["setModes"]);
    expect(parts.find((p) => p.ref === "components/remote")?.componentType).toBe("Link");
  });

  it("addresses modes by id when present, else label, keeping raw invalid labels", () => {
    const source = {
      modes: [
        { id: "OPERATING_MODES", label: "Operating Modes" },
        { label: "High Rate" },
      ],
    } as PathRefSource;
    const parts = buildPathRefParts(source);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({
      ref: "modes/OPERATING_MODES",
      label: "Operating Modes",
      componentType: "Mode",
      targets: ["setModes"],
      valid: true,
    });
    expect(parts[1]).toMatchObject({ ref: "modes/High Rate", valid: false });

    expect(buildPathRefParts(source, { includeInvalid: false }).map((p) => p.ref)).toEqual(["modes/OPERATING_MODES"]);
  });

  it("dedupes by exact ref, keeping the first occurrence", () => {
    const source = {
      parameters: [
        { name: "gain", type: "Quantity", label: "First Gain", uom: { code: "1" } },
        { name: "gain", type: "Count", label: "Shadowed Gain" },
      ],
    } as never;
    const parts = buildPathRefParts(source);
    expect(parts).toHaveLength(1);
    expect(parts[0]?.label).toBe("First Gain");
  });

  it("returns an empty list for an undefined source", () => {
    expect(buildPathRefParts(undefined)).toEqual([]);
  });
});
