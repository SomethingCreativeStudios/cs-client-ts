import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SystemFeatureSchema } from "../../src/models/geojson/system-feature.js";
import { SmlSystemSchema } from "../../src/models/sensorml/sml-system.js";
import { systemFromGeoJson, systemFromSml, systemToGeoJson, systemToSml } from "../../src/codec/system-codec.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadGeojson(file: string) {
  const json = JSON.parse(readFileSync(join(__dirname, "..", "fixtures", "geojson", "system", file), "utf-8"));
  return SystemFeatureSchema.parse(json);
}
function loadSml(file: string) {
  const json = JSON.parse(readFileSync(join(__dirname, "..", "fixtures", "sensorml", "system", file), "utf-8"));
  return SmlSystemSchema.parse(json);
}

describe("systemFromGeoJson", () => {
  it("maps a GeoJSON System fixture to the common model", () => {
    const feature = loadGeojson("thermometer-sensor-geojson.json");
    const system = systemFromGeoJson(feature);
    expect(system.sourceEncoding).toBe("geojson");
    expect(system.uniqueId).toBe("urn:x-ogc:systems:001");
    expect(system.label).toBe("Outdoor Thermometer 001");
    expect(system.featureType).toBe("http://www.w3.org/ns/sosa/Sensor");
    expect(system.assetType).toBe("Equipment");
    expect(system.position?.type).toBe("Point");
    expect(system.typeOf?.href).toContain("procedures/TP60S");
    expect((system as unknown as Record<string, unknown>).geometry).toBeUndefined();
    expect((system as unknown as Record<string, unknown>).systemKindLink).toBeUndefined();
    // SML-only fields must be absent
    expect(system.inputs).toBeUndefined();
    expect(system.characteristics).toBeUndefined();
    expect(system.raw).toBe(feature);
  });

  it("serializes common typeOf back to GeoJSON systemKind@link", () => {
    const feature = systemToGeoJson({
      uniqueId: "urn:x:1",
      label: "Thermometer",
      featureType: "http://www.w3.org/ns/sosa/Sensor",
      typeOf: { href: "https://api.example.org/procedures/p1", title: "Procedure" },
      position: { type: "Point", coordinates: [1, 2] },
    });
    expect(feature.properties["systemKind@link"]?.href).toBe("https://api.example.org/procedures/p1");
    expect(feature.geometry).toEqual({ type: "Point", coordinates: [1, 2] });
  });

  it("promotes server-provided relation links and keeps editable links separate", () => {
    const feature = SystemFeatureSchema.parse({
      ...loadGeojson("uav-platform-geojson.json"),
      links: [
        { href: "/systems/child", rel: "self" },
        { href: "/systems/parent", rel: "ogc-rel:parentSystem" },
        { href: "/systems/child/subsystems", rel: "ogc-rel:subsystems" },
        { href: "/systems/child/datastreams", rel: "datastreams" },
      ],
    });
    const system = systemFromGeoJson(feature);
    expect(system.parentSystem?.href).toBe("/systems/parent");
    expect(system.subsystems?.href).toBe("/systems/child/subsystems");
    expect(system.datastreams?.href).toBe("/systems/child/datastreams");
    expect(system.links).toEqual([{ href: "/systems/child", rel: "self" }]);
  });

  it("does not serialize server-provided relation links", () => {
    const feature = systemToGeoJson({
      uniqueId: "urn:x:1",
      label: "Thermometer",
      featureType: "http://www.w3.org/ns/sosa/Sensor",
      links: [
        { href: "/systems/1", rel: "self" },
        { href: "/systems/1/subsystems", rel: "ogc-rel:subsystems" },
      ],
    });
    expect(feature.links).toEqual([{ href: "/systems/1", rel: "self" }]);
  });
});

describe("systemFromSml", () => {
  it("maps a rich SensorML System fixture to the common model", () => {
    const doc = loadSml("weather_station_system.json");
    const system = systemFromSml(doc);
    expect(system.sourceEncoding).toBe("sml");
    expect(system.uniqueId).toBe("urn:x-davis:station:vantagepro2");
    expect(system.processType).toBe("PhysicalSystem");
    expect(system.characteristics?.length).toBeGreaterThan(0);
    expect(system.components?.length).toBe(5);
    expect(system.assetType).toBeUndefined();
    expect(system.raw).toBe(doc);
  });

  it("maps position for a PhysicalSystem instance", () => {
    const doc = loadSml("sensor_instance_with_geojson_location.json");
    const system = systemFromSml(doc);
    expect(system.position).toBeDefined();
    expect(system.position?.type).toBe("Point");
    expect((system as unknown as Record<string, unknown>).geometry).toBeUndefined();
  });

  it("maps SensorML cs:AssetType classifiers to common assetType", () => {
    const doc = SmlSystemSchema.parse({
      type: "SimpleProcess",
      uniqueId: "urn:x:system:1",
      label: "Test System",
      definition: "http://www.w3.org/ns/sosa/Sensor",
      classifiers: [{ definition: "cs:AssetType", label: "Asset Type", value: "Equipment" }],
    });
    const system = systemFromSml(doc);
    expect(system.assetType).toBe("Equipment");
  });

  it("serializes common typeOf directly in SensorML", () => {
    const doc = systemToSml({
      uniqueId: "urn:x:1",
      label: "Thermometer",
      featureType: "http://www.w3.org/ns/sosa/Sensor",
      typeOf: { href: "https://api.example.org/procedures/p1", title: "Procedure" },
    });
    expect((doc as { typeOf?: { href?: string } }).typeOf?.href).toBe("https://api.example.org/procedures/p1");
  });

  it("serializes common assetType to the SensorML cs:AssetType classifier", () => {
    const doc = systemToSml({
      uniqueId: "urn:x:1",
      label: "Thermometer",
      featureType: "http://www.w3.org/ns/sosa/Sensor",
      assetType: "Equipment",
    });
    expect(doc.classifiers).toContainEqual({ definition: "cs:AssetType", label: "Asset Type", value: "Equipment" });
  });

  it("normalizes SensorML attachedTo as parentSystem", () => {
    const doc = loadSml("sensor_instance_with_parent_and_frame.json");
    const system = systemFromSml(doc);
    expect(system.parentSystem?.href).toBe(system.attachedTo?.href);
    expect(system.parentSystem?.href).toBe("http://link/to/parent/sensor");
  });
});
