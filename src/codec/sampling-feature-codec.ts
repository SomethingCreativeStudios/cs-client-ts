import type { SamplingFeature, SamplingFeatureInput } from "../models/resources/sampling-feature.js";
import type { SamplingFeatureGeoJson as SamplingFeatureWire } from "../models/geojson/sampling-feature.js";
import { toCamelKeys, toWireKeys } from "./keys.js";
import { findRelationLink, withoutRelationLinks } from "./relation-links.js";

const SAMPLING_FEATURE_SERVER_LINK_RELATIONS = ["parentSystem", "sampleOf", "datastreams", "controlstreams"] as const;

export function samplingFeatureFromGeoJson(feature: SamplingFeatureWire): SamplingFeature {
  const props = toCamelKeys<Record<string, unknown>>(feature.properties);
  const links = feature.links;
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
    links: withoutRelationLinks(links, SAMPLING_FEATURE_SERVER_LINK_RELATIONS),
    parentSystem: findRelationLink(links, "parentSystem"),
    sampleOf: findRelationLink(links, "sampleOf"),
    datastreams: findRelationLink(links, "datastreams"),
    controlstreams: findRelationLink(links, "controlstreams"),
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
    links: withoutRelationLinks(input.links, SAMPLING_FEATURE_SERVER_LINK_RELATIONS),
  } as SamplingFeatureWire;
}
