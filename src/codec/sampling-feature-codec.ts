import type { SamplingFeature, SamplingFeatureInput } from "../models/resources/sampling-feature.js";
import type { SamplingFeatureGeoJson as SamplingFeatureWire } from "../models/geojson/sampling-feature.js";
import { toCamelKeys, toWireKeys } from "./keys.js";

export function samplingFeatureFromGeoJson(feature: SamplingFeatureWire): SamplingFeature {
  const props = toCamelKeys<Record<string, unknown>>(feature.properties);
  return {
    sourceEncoding: "geojson",
    id: feature.id,
    uniqueId: props.uid as string,
    label: props.name as string,
    description: props.description as string | undefined,
    featureType: props.featureType as string,
    validTime: props.validTime as SamplingFeature["validTime"],
    geometry: feature.geometry,
    bbox: feature.bbox,
    sampledFeatureLink: props.sampledFeatureLink as SamplingFeature["sampledFeatureLink"],
    links: feature.links,
    raw: feature,
  };
}

export function samplingFeatureToGeoJson(input: SamplingFeatureInput): SamplingFeatureWire {
  const properties = toWireKeys<Record<string, unknown>>({
    featureType: input.featureType,
    uid: input.uniqueId,
    name: input.label,
    description: input.description,
    validTime: input.validTime,
    sampledFeatureLink: input.sampledFeatureLink,
  });
  return {
    type: "Feature",
    geometry: input.geometry ?? null,
    bbox: input.bbox,
    properties,
    links: input.links,
  } as SamplingFeatureWire;
}
