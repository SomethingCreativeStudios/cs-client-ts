import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ProcedureFeatureSchema } from "../../src/models/geojson/procedure-feature.js";
import { SmlProcedureSchema } from "../../src/models/sensorml/sml-procedure.js";
import { DeploymentFeatureSchema } from "../../src/models/geojson/deployment-feature.js";
import { SmlDeploymentSchema } from "../../src/models/sensorml/sml-deployment.js";
import { SamplingFeatureGeoJsonSchema } from "../../src/models/geojson/sampling-feature.js";
import { DerivedPropertySchema } from "../../src/models/sensorml/derived-property.js";
import { procedureFromGeoJson, procedureFromSml, procedureToGeoJson } from "../../src/codec/procedure-codec.js";
import { deploymentFromGeoJson, deploymentFromSml, deploymentToGeoJson, deploymentToSml } from "../../src/codec/deployment-codec.js";
import { samplingFeatureFromGeoJson } from "../../src/codec/sampling-feature-codec.js";
import { propertyFromSml } from "../../src/codec/property-codec.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesRoot = join(__dirname, "..", "fixtures");

function load(...parts: string[]): unknown {
  return JSON.parse(readFileSync(join(fixturesRoot, ...parts), "utf-8"));
}

describe("procedure codec", () => {
  it("maps a GeoJSON procedure", () => {
    const raw = load("geojson", "procedure", "sensor-datasheet-geojson.json") as Record<string, unknown>;
    const feature = ProcedureFeatureSchema.parse({
      ...raw,
      properties: {
        ...(raw.properties as Record<string, unknown>),
        validTime: ["2024-01-01T00:00:00Z", "now"],
      },
    });
    const procedure = procedureFromGeoJson(feature);
    expect(procedure.sourceEncoding).toBe("geojson");
    expect(procedure.uniqueId).toBe("urn:x-gill:datasheets:windmaster:v1");
    expect(procedure.validTime).toEqual(["2024-01-01T00:00:00Z", "now"]);
  });

  it("serializes common Procedure validTime to GeoJSON properties", () => {
    const feature = procedureToGeoJson({
      uniqueId: "urn:x:procedure:1",
      label: "Procedure",
      featureType: "http://www.w3.org/ns/sosa/Procedure",
      validTime: ["2024-01-01T00:00:00Z", "now"],
    });
    expect(feature.properties.validTime).toEqual(["2024-01-01T00:00:00Z", "now"]);
  });

  it("maps a SensorML procedure and never carries position", () => {
    const raw = load("sensorml", "procedure", "simple_process.json") as Record<string, unknown>;
    const doc = SmlProcedureSchema.parse({ ...raw, definition: "http://www.w3.org/ns/sosa/Procedure" });
    const procedure = procedureFromSml(doc);
    expect(procedure.sourceEncoding).toBe("sml");
    expect(procedure.uniqueId).toBe("urn:x-org:process:windchill:001");
    expect((procedure as unknown as Record<string, unknown>).position).toBeUndefined();
  });
});

describe("deployment codec", () => {
  it("maps a GeoJSON deployment", () => {
    const feature = DeploymentFeatureSchema.parse(load("geojson", "deployment", "deployment-geojson.json"));
    const deployment = deploymentFromGeoJson(feature);
    expect(deployment.uniqueId).toBe("urn:x-ogc:deployments:D001");
    expect(deployment.platformLink?.href).toContain("systems/27559");
    expect(deployment.platform?.system.href).toContain("systems/27559");
    expect(deployment.deployedSystemsLink?.length).toBe(3);
    expect(deployment.deployedSystems?.length).toBe(3);
  });

  it("maps a SensorML deployment", () => {
    const doc = SmlDeploymentSchema.parse(load("sensorml", "deployment", "deployment_sd001.json"));
    const deployment = deploymentFromSml(doc);
    expect(deployment.uniqueId).toBe("urn:x-saildrone:mission:2025");
    expect(deployment.deployedSystems?.length).toBe(3);
    expect(deployment.deployedSystemsLink?.length).toBe(3);
    expect(deployment.platform?.system.href).toContain("systems/27559");
    expect(deployment.platformLink?.href).toContain("systems/27559");
  });

  it("serializes SensorML deployment associations to GeoJSON links", () => {
    const feature = deploymentToGeoJson({
      uniqueId: "urn:x:deployment:1",
      label: "Deployment",
      featureType: "http://www.w3.org/ns/sosa/Deployment",
      validTime: ["2024-01-01T00:00:00Z", "now"],
      platform: { system: { href: "https://api.example.org/systems/platform" } },
      deployedSystems: [{ name: "sensor1", system: { href: "https://api.example.org/systems/sensor1" } }],
    });
    expect(feature.properties["platform@link"]?.href).toBe("https://api.example.org/systems/platform");
    expect(feature.properties["deployedSystems@link"]?.[0]?.href).toBe("https://api.example.org/systems/sensor1");
  });

  it("serializes GeoJSON deployment links to SensorML associations", () => {
    const doc = deploymentToSml({
      uniqueId: "urn:x:deployment:1",
      label: "Deployment",
      featureType: "http://www.w3.org/ns/sosa/Deployment",
      validTime: ["2024-01-01T00:00:00Z", "now"],
      platformLink: { href: "https://api.example.org/systems/platform" },
      deployedSystemsLink: [{ href: "https://api.example.org/systems/sensor1" }],
    });
    expect(doc.platform?.system.href).toBe("https://api.example.org/systems/platform");
    expect(doc.deployedSystems?.[0]?.system.href).toBe("https://api.example.org/systems/sensor1");
  });
});

describe("sampling feature codec", () => {
  it("maps a GeoJSON sampling feature", () => {
    const feature = SamplingFeatureGeoJsonSchema.parse(load("geojson", "sampling-feature", "sampling-point-geojson.json"));
    const sf = samplingFeatureFromGeoJson(feature);
    expect(sf.uniqueId).toBe("urn:x-usgs:sites:301244087575701:sf:bottom");
    expect(sf.sampledFeatureLink.href).toContain("112TRRC");
  });
});

describe("property codec", () => {
  it("maps a bare DerivedProperty document", () => {
    const doc = DerivedPropertySchema.parse(load("sensorml", "property", "derived_prop2.json"));
    const property = propertyFromSml({ uniqueId: "urn:example:property:avg-cpu-temp", ...doc });
    expect(property.baseProperty).toBe("http://qudt.org/vocab/quantitykind/Temperature");
    expect(property.statistic).toBe("http://sensorml.com/ont/x-stats/HourlyMean");
  });
});
