import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AnySmlSystemSchema, SmlSystemSchema } from "../../src/models/sensorml/sml-system.js";
import { AnyProcedureSchema, SmlProcedureSchema } from "../../src/models/sensorml/sml-procedure.js";
import { SmlDeploymentSchema } from "../../src/models/sensorml/sml-deployment.js";
import { DerivedPropertySchema } from "../../src/models/sensorml/derived-property.js";

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
