import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AnySmlSystemSchema, SmlSystemSchema } from "../../src/models/sensorml/sml-system.js";
import { AnyProcedureSchema, SmlProcedureSchema } from "../../src/models/sensorml/sml-procedure.js";
import { SmlDeploymentSchema } from "../../src/models/sensorml/sml-deployment.js";
import { DerivedPropertySchema } from "../../src/models/sensorml/derived-property.js";
import { PathRefSchema } from "../../src/models/sensorml/path-ref.js";
import { SettingsSchema } from "../../src/models/sensorml/described-object.js";
import { ConnectionListSchema } from "../../src/models/sensorml/processes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesRoot = join(__dirname, "..", "fixtures", "sensorml");

function jsonFiles(subdir: string): string[] {
  return readdirSync(join(fixturesRoot, subdir)).filter((f) => f.endsWith(".json"));
}

function load(subdir: string, file: string): unknown {
  return JSON.parse(readFileSync(join(fixturesRoot, subdir, file), "utf-8"));
}

describe("AnySmlSystemSchema", () => {
  it.each(jsonFiles("system"))("parses fixture %s", (file) => {
    const json = load("system", file);
    const result = AnySmlSystemSchema.safeParse(json);
    if (!result.success) {
      throw new Error(`${file}: ${JSON.stringify(result.error.format(), null, 2)}`);
    }
  });

  it("keeps top-level API System validation stricter than nested process parsing", () => {
    const nestedLike = { type: "SimpleProcess", label: "Nested", definition: "http://www.w3.org/ns/sosa/Sensor" };
    expect(AnySmlSystemSchema.safeParse(nestedLike).success).toBe(true);
    expect(SmlSystemSchema.safeParse(nestedLike).success).toBe(false);
  });
});

describe("AnyProcedureSchema", () => {
  it.each(jsonFiles("procedure"))("parses fixture %s", (file) => {
    const json = load("procedure", file);
    const result = AnyProcedureSchema.safeParse(json);
    if (!result.success) {
      throw new Error(`${file}: ${JSON.stringify(result.error.format(), null, 2)}`);
    }
  });

  it("rejects a system with position as a procedure", () => {
    const json = load("system", "sensor_instance_with_geojson_location.json") as Record<string, unknown>;
    expect(json.position).toBeDefined();
    const result = AnyProcedureSchema.safeParse(json);
    expect(result.success).toBe(false);
  });

  it("keeps top-level API Procedure validation stricter than nested process parsing", () => {
    const nestedLike = { type: "SimpleProcess", label: "Nested", definition: "http://www.w3.org/ns/sosa/Procedure" };
    expect(AnyProcedureSchema.safeParse(nestedLike).success).toBe(true);
    expect(SmlProcedureSchema.safeParse(nestedLike).success).toBe(false);
  });
});

describe("SmlDeploymentSchema", () => {
  it.each(jsonFiles("deployment"))("parses fixture %s", (file) => {
    const json = load("deployment", file);
    const result = SmlDeploymentSchema.safeParse(json);
    if (!result.success) {
      throw new Error(`${file}: ${JSON.stringify(result.error.format(), null, 2)}`);
    }
  });
});

describe("DerivedPropertySchema", () => {
  it.each(jsonFiles("property"))("parses fixture %s", (file) => {
    const json = load("property", file);
    const result = DerivedPropertySchema.safeParse(json);
    if (!result.success) {
      throw new Error(`${file}: ${JSON.stringify(result.error.format(), null, 2)}`);
    }
  });
});

describe("PathRefSchema", () => {
  it.each([
    "parameters/gain",
    "parameters/settings/samplingRate",
    "inputs/temperature",
    "outputs/result",
    "components/sensor_1/outputs/temperature",
    "modes/OPERATING_MODES",
  ])("accepts %s", (ref) => {
    expect(PathRefSchema.safeParse(ref).success).toBe(true);
  });

  it.each(["#sampleRate", "1bad/name", "parameters/", "bad/gain", "parameters/1bad", ""])("rejects %s", (ref) => {
    expect(PathRefSchema.safeParse(ref).success).toBe(false);
  });
});

describe("SettingsSchema", () => {
  it("validates refs across every settings group", () => {
    const result = SettingsSchema.safeParse({
      setValues: [{ ref: "parameters/gain", value: 1.6 }],
      setArrayValues: [{ ref: "parameters/calCoefs", value: [1, 2, 3] }],
      setModes: [{ ref: "modes/OPERATING_MODES", value: "TEST" }],
      setConstraints: [{ ref: "inputs/temperature", type: "AllowedValues" }],
      setStatus: [{ ref: "components/pump", value: "enabled" }],
    });

    expect(result.success).toBe(true);
  });

  it.each(["#sampleRate", "1bad/name", "", "bad/gain"])("rejects invalid setting ref %s", (ref) => {
    expect(SettingsSchema.safeParse({ setValues: [{ ref, value: "60s" }] }).success).toBe(false);
  });
});

describe("ConnectionListSchema", () => {
  it("validates source and destination path refs", () => {
    expect(ConnectionListSchema.safeParse([
      { source: "components/sensor/outputs/temperature", destination: "outputs/weatherRecord" },
      { source: "inputs/commandRate", destination: "components/sensor/inputs/sampleRate" },
    ]).success).toBe(true);
  });

  it("rejects invalid connection refs", () => {
    expect(ConnectionListSchema.safeParse([
      { source: "#temperature", destination: "outputs/weatherRecord" },
    ]).success).toBe(false);
  });
});
