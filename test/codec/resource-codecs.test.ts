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

  it("promotes implementing systems and keeps other links separate", () => {
    const feature = ProcedureFeatureSchema.parse({
      ...(load("geojson", "procedure", "sensor-datasheet-geojson.json") as Record<string, unknown>),
      links: [
        { href: "/procedures/p1", rel: "self" },
        { href: "/procedures/p1/systems", rel: "ogc-rel:implementingSystems" },
      ],
    });
    const procedure = procedureFromGeoJson(feature);
    expect(procedure.implementingSystems?.href).toBe("/procedures/p1/systems");
    expect(procedure.links).toEqual([{ href: "/procedures/p1", rel: "self" }]);
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

  it("does not serialize server-provided procedure relation links", () => {
    const feature = procedureToGeoJson({
      uniqueId: "urn:x:procedure:1",
      label: "Procedure",
      featureType: "http://www.w3.org/ns/sosa/Procedure",
      links: [
        { href: "/procedures/p1", rel: "self" },
        { href: "/procedures/p1/systems", rel: "ogc-rel:implementingSystems" },
      ],
    });
    expect(feature.links).toEqual([{ href: "/procedures/p1", rel: "self" }]);
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
    expect(deployment.platform?.system.href).toContain("systems/27559");
    expect(deployment.deployedSystems?.length).toBe(3);
    expect(deployment.location).toEqual(feature.geometry);
    expect((deployment as unknown as Record<string, unknown>).geometry).toBeUndefined();
    expect((deployment as unknown as Record<string, unknown>).platformLink).toBeUndefined();
    expect((deployment as unknown as Record<string, unknown>).deployedSystemsLink).toBeUndefined();
  });

  it("promotes deployment server links and keeps other links separate", () => {
    const feature = DeploymentFeatureSchema.parse({
      ...(load("geojson", "deployment", "deployment-geojson.json") as Record<string, unknown>),
      links: [
        { href: "/deployments/d1", rel: "self" },
        { href: "/deployments/parent", rel: "ogc-rel:parentDeployment" },
        { href: "/deployments/d1/subdeployments", rel: "subdeployments" },
        { href: "/deployments/d1/controlstreams", rel: "ogc-rel:controlstreams" },
      ],
    });
    const deployment = deploymentFromGeoJson(feature);
    expect(deployment.parentDeployment?.href).toBe("/deployments/parent");
    expect(deployment.subdeployments?.href).toBe("/deployments/d1/subdeployments");
    expect(deployment.controlstreams?.href).toBe("/deployments/d1/controlstreams");
    expect(deployment.links).toEqual([{ href: "/deployments/d1", rel: "self" }]);
  });

  it("maps a SensorML deployment", () => {
    const doc = SmlDeploymentSchema.parse(load("sensorml", "deployment", "deployment_sd001.json"));
    const deployment = deploymentFromSml(doc);
    expect(deployment.uniqueId).toBe("urn:x-saildrone:mission:2025");
    expect(deployment.deployedSystems?.length).toBe(3);
    expect(deployment.platform?.system.href).toContain("systems/27559");
    expect((deployment as unknown as Record<string, unknown>).geometry).toBeUndefined();
    expect((deployment as unknown as Record<string, unknown>).platformLink).toBeUndefined();
    expect((deployment as unknown as Record<string, unknown>).deployedSystemsLink).toBeUndefined();
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

  it("does not serialize server-provided deployment relation links", () => {
    const feature = deploymentToGeoJson({
      uniqueId: "urn:x:deployment:1",
      label: "Deployment",
      featureType: "http://www.w3.org/ns/sosa/Deployment",
      validTime: ["2024-01-01T00:00:00Z", "now"],
      links: [
        { href: "/deployments/d1", rel: "self" },
        { href: "/deployments/d1/subdeployments", rel: "ogc-rel:subdeployments" },
      ],
    });
    expect(feature.links).toEqual([{ href: "/deployments/d1", rel: "self" }]);
  });

  it("serializes normalized deployment associations to SensorML", () => {
    const doc = deploymentToSml({
      uniqueId: "urn:x:deployment:1",
      label: "Deployment",
      featureType: "http://www.w3.org/ns/sosa/Deployment",
      validTime: ["2024-01-01T00:00:00Z", "now"],
      platform: { system: { href: "https://api.example.org/systems/platform" } },
      deployedSystems: [{ name: "sensor1", system: { href: "https://api.example.org/systems/sensor1" } }],
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

  it("promotes sampling feature server links and keeps other links separate", () => {
    const feature = SamplingFeatureGeoJsonSchema.parse({
      ...(load("geojson", "sampling-feature", "sampling-point-geojson.json") as Record<string, unknown>),
      links: [
        { href: "/samplingFeatures/sf1", rel: "self" },
        { href: "/systems/sys1", rel: "parentSystem" },
        { href: "/samplingFeatures/sf1/sampleOf", rel: "ogc-rel:sampleOf" },
        { href: "/samplingFeatures/sf1/datastreams", rel: "ogc-rel:datastreams" },
      ],
    });
    const sf = samplingFeatureFromGeoJson(feature);
    expect(sf.parentSystem?.href).toBe("/systems/sys1");
    expect(sf.sampleOf?.href).toBe("/samplingFeatures/sf1/sampleOf");
    expect(sf.datastreams?.href).toBe("/samplingFeatures/sf1/datastreams");
    expect(sf.links).toEqual([{ href: "/samplingFeatures/sf1", rel: "self" }]);
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
