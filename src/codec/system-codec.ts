import type { System, SystemInput } from "../models/resources/system.js";
import { GeometrySchema, type Geometry } from "../models/common/geometry.js";
import type { Term } from "../models/sensorml/described-object.js";
import type { SystemFeature } from "../models/geojson/system-feature.js";
import type { SmlSystem } from "../models/sensorml/sml-system.js";
import type { Position } from "../models/sensorml/physical-process.js";
import { toCamelKeys, toWireKeys } from "./keys.js";
import { findRelationLink, withoutRelationLinks } from "./relation-links.js";

const ASSET_TYPE_CLASSIFIER_DEFINITION = "cs:AssetType";
const SYSTEM_SERVER_LINK_RELATIONS = [
  "parentSystem",
  "subsystems",
  "samplingFeatures",
  "deployments",
  "procedures",
  "datastreams",
  "controlstreams",
] as const;

function assetTypeFromClassifiers(classifiers: Term[] | undefined): System["assetType"] {
  return classifiers?.find((term) => term.definition === ASSET_TYPE_CLASSIFIER_DEFINITION)?.value as System["assetType"] | undefined;
}

function withAssetTypeClassifier(classifiers: Term[] | undefined, assetType: SystemInput["assetType"]): Term[] | undefined {
  if (assetType === undefined) return classifiers;
  const nextClassifier: Term = {
    definition: ASSET_TYPE_CLASSIFIER_DEFINITION,
    label: "Asset Type",
    value: assetType,
  };
  if (!classifiers?.length) return [nextClassifier];
  let replaced = false;
  const next = classifiers.map((term) => {
    if (term.definition !== ASSET_TYPE_CLASSIFIER_DEFINITION) return term;
    replaced = true;
    return { ...term, value: assetType };
  });
  return replaced ? next : [...next, nextClassifier];
}

function geometryToPosition(geometry: Geometry | null | undefined): Position | undefined {
  return geometry === null || geometry === undefined ? undefined : (geometry as Position);
}

function positionToGeometry(position: Position | undefined): Geometry | undefined {
  const result = GeometrySchema.safeParse(position);
  return result.success ? result.data : undefined;
}

/** Build the common superset System model from a GeoJSON-encoded resource. */
export function systemFromGeoJson(feature: SystemFeature): System {
  const props = toCamelKeys<Record<string, unknown>>(feature.properties);
  const links = feature.links;
  return {
    sourceEncoding: "geojson",
    id: feature.id,
    uniqueId: props.uid as string,
    label: props.name as string,
    description: props.description as string | undefined,
    featureType: props.featureType as string,
    validTime: props.validTime as System["validTime"],
    links: withoutRelationLinks(links, SYSTEM_SERVER_LINK_RELATIONS),
    parentSystem: findRelationLink(links, "parentSystem"),
    subsystems: findRelationLink(links, "subsystems"),
    samplingFeatures: findRelationLink(links, "samplingFeatures"),
    deployments: findRelationLink(links, "deployments"),
    procedures: findRelationLink(links, "procedures"),
    datastreams: findRelationLink(links, "datastreams"),
    controlstreams: findRelationLink(links, "controlstreams"),
    assetType: props.assetType as System["assetType"],
    position: geometryToPosition(feature.geometry),
    bbox: feature.bbox,
    typeOf: props.systemKindLink as System["typeOf"],
    raw: feature,
  };
}

/**
 * A SmlSystem is a union of four process kinds; only PhysicalComponent/PhysicalSystem
 * carry position/attachedTo/frames, and only AggregateProcess/PhysicalSystem carry
 * components/connections. Widen to a plain superset record once here (fields are
 * validated by the wire Zod schema already, so this is a type-level convenience,
 * not a runtime risk) rather than casting at every field access below.
 */
type AnySmlSystemFields = Omit<System, "sourceEncoding" | "raw" | "featureType"> & { type?: string; definition?: string };

/** Build the common superset System model from a SensorML-encoded resource. */
export function systemFromSml(doc: SmlSystem): System {
  const d = doc as unknown as AnySmlSystemFields;
  const links = d.links;
  return {
    sourceEncoding: "sml",
    id: d.id,
    uniqueId: d.uniqueId,
    label: d.label,
    description: d.description,
    featureType: d.definition ?? "",
    validTime: d.validTime,
    links: withoutRelationLinks(links, SYSTEM_SERVER_LINK_RELATIONS),
    parentSystem: (d.attachedTo as System["parentSystem"] | undefined) ?? findRelationLink(links, "parentSystem"),
    subsystems: findRelationLink(links, "subsystems"),
    samplingFeatures: findRelationLink(links, "samplingFeatures"),
    deployments: findRelationLink(links, "deployments"),
    procedures: findRelationLink(links, "procedures"),
    datastreams: findRelationLink(links, "datastreams"),
    controlstreams: findRelationLink(links, "controlstreams"),
    processType: d.type as System["processType"],
    lang: d.lang,
    keywords: d.keywords,
    identifiers: d.identifiers,
    classifiers: d.classifiers,
    assetType: assetTypeFromClassifiers(d.classifiers),
    securityConstraints: d.securityConstraints,
    legalConstraints: d.legalConstraints,
    characteristics: d.characteristics,
    capabilities: d.capabilities,
    contacts: d.contacts,
    documents: d.documents,
    history: d.history,
    typeOf: d.typeOf,
    configuration: d.configuration,
    featuresOfInterest: d.featuresOfInterest,
    inputs: d.inputs,
    outputs: d.outputs,
    parameters: d.parameters,
    modes: d.modes,
    attachedTo: d.attachedTo,
    localReferenceFrames: d.localReferenceFrames,
    localTimeFrames: d.localTimeFrames,
    position: d.position,
    components: d.components,
    connections: d.connections,
    raw: doc,
  };
}

/**
 * Serialize a System input to GeoJSON. Fields with no GeoJSON representation
 * (inputs/outputs, characteristics, components, ...) are silently dropped —
 * this is the documented lossy behavior of cross-encoding writes.
 */
export function systemToGeoJson(input: SystemInput): SystemFeature {
  const properties = toWireKeys<Record<string, unknown>>({
    featureType: input.featureType,
    uid: input.uniqueId,
    name: input.label,
    description: input.description,
    assetType: input.assetType,
    validTime: input.validTime,
    systemKindLink: input.typeOf,
  });
  return {
    type: "Feature",
    geometry: positionToGeometry(input.position) ?? null,
    bbox: input.bbox,
    properties,
    links: withoutRelationLinks(input.links, SYSTEM_SERVER_LINK_RELATIONS),
  } as SystemFeature;
}

/** Serialize a System input to SensorML-JSON. GeoJSON-only `bbox` is dropped. */
export function systemToSml(input: SystemInput): SmlSystem {
  const position = input.position;
  const type = input.processType ?? (position !== undefined ? "PhysicalSystem" : "SimpleProcess");
  return {
    type,
    uniqueId: input.uniqueId,
    label: input.label,
    description: input.description,
    definition: input.featureType,
    validTime: input.validTime,
    lang: input.lang,
    keywords: input.keywords,
    identifiers: input.identifiers,
    classifiers: withAssetTypeClassifier(input.classifiers, input.assetType),
    securityConstraints: input.securityConstraints,
    legalConstraints: input.legalConstraints,
    characteristics: input.characteristics,
    capabilities: input.capabilities,
    contacts: input.contacts,
    documents: input.documents,
    history: input.history,
    typeOf: input.typeOf,
    configuration: input.configuration,
    featuresOfInterest: input.featuresOfInterest,
    inputs: input.inputs,
    outputs: input.outputs,
    parameters: input.parameters,
    modes: input.modes,
    attachedTo: input.attachedTo,
    localReferenceFrames: input.localReferenceFrames,
    localTimeFrames: input.localTimeFrames,
    position,
    components: input.components,
    connections: input.connections,
    links: withoutRelationLinks(input.links, SYSTEM_SERVER_LINK_RELATIONS),
  } as unknown as SmlSystem;
}
