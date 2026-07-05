import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SystemFeatureSchema } from "../../src/models/geojson/system-feature.js";
import { DeploymentFeatureSchema } from "../../src/models/geojson/deployment-feature.js";
import { ProcedureFeatureSchema } from "../../src/models/geojson/procedure-feature.js";
import { SamplingFeatureGeoJsonSchema } from "../../src/models/geojson/sampling-feature.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesRoot = join(__dirname, "..", "fixtures", "geojson");

function jsonFiles(subdir: string): string[] {
  return readdirSync(join(fixturesRoot, subdir)).filter((f) => f.endsWith(".json"));
}

function load(subdir: string, file: string): unknown {
  return JSON.parse(readFileSync(join(fixturesRoot, subdir, file), "utf-8"));
}

function expectParses<T>(schema: { safeParse: (v: unknown) => { success: boolean; error?: unknown } }, file: string, json: unknown) {
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new Error(`${file}: ${JSON.stringify(result.error, null, 2)}`);
  }
}

describe("SystemFeatureSchema", () => {
  it.each(jsonFiles("system"))("parses fixture %s", (file) => {
    expectParses(SystemFeatureSchema, file, load("system", file));
  });
});

describe("DeploymentFeatureSchema", () => {
  it.each(jsonFiles("deployment"))("parses fixture %s", (file) => {
    expectParses(DeploymentFeatureSchema, file, load("deployment", file));
  });
});

describe("ProcedureFeatureSchema", () => {
  it.each(jsonFiles("procedure"))("parses fixture %s", (file) => {
    expectParses(ProcedureFeatureSchema, file, load("procedure", file));
  });
});

describe("SamplingFeatureGeoJsonSchema", () => {
  it.each(jsonFiles("sampling-feature"))("parses fixture %s", (file) => {
    expectParses(SamplingFeatureGeoJsonSchema, file, load("sampling-feature", file));
  });
});
