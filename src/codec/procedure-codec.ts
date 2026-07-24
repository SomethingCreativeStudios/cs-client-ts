import type { Procedure, ProcedureInput } from "../models/resources/procedure.js";
import type { ProcedureFeature } from "../models/geojson/procedure-feature.js";
import type { SmlProcedure } from "../models/sensorml/sml-procedure.js";
import { toCamelKeys, toWireKeys } from "./keys.js";
import { findRelationLink, withoutRelationLinks } from "./relation-links.js";

const PROCEDURE_SERVER_LINK_RELATIONS = ["implementingSystems"] as const;

export function procedureFromGeoJson(feature: ProcedureFeature): Procedure {
  const props = toCamelKeys<Record<string, unknown>>(feature.properties);
  const links = feature.links;
  return {
    sourceEncoding: "geojson",
    id: feature.id,
    uniqueId: props.uid as string,
    label: props.name as string,
    description: props.description as string | undefined,
    featureType: props.featureType as string,
    validTime: props.validTime as Procedure["validTime"],
    links: withoutRelationLinks(links, PROCEDURE_SERVER_LINK_RELATIONS),
    implementingSystems: findRelationLink(links, "implementingSystems"),
    raw: feature,
  };
}

type AnySmlProcedureFields = Omit<Procedure, "sourceEncoding" | "raw" | "featureType"> & { type?: string; definition?: string };

export function procedureFromSml(doc: SmlProcedure): Procedure {
  const d = doc as unknown as AnySmlProcedureFields;
  const links = d.links;
  return {
    sourceEncoding: "sml",
    id: d.id,
    uniqueId: d.uniqueId,
    label: d.label,
    description: d.description,
    featureType: d.definition ?? "",
    validTime: d.validTime,
    links: withoutRelationLinks(links, PROCEDURE_SERVER_LINK_RELATIONS),
    implementingSystems: findRelationLink(links, "implementingSystems"),
    processType: d.type as Procedure["processType"],
    lang: d.lang,
    keywords: d.keywords,
    identifiers: d.identifiers,
    classifiers: d.classifiers,
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
    components: d.components,
    connections: d.connections,
    raw: doc,
  };
}

/** Serialize a Procedure input to GeoJSON. Geometry is always null for procedures. */
export function procedureToGeoJson(input: ProcedureInput): ProcedureFeature {
  const properties = toWireKeys<Record<string, unknown>>({
    featureType: input.featureType,
    uid: input.uniqueId,
    name: input.label,
    description: input.description,
    validTime: input.validTime,
  });
  return {
    type: "Feature",
    geometry: null,
    properties,
    links: withoutRelationLinks(input.links, PROCEDURE_SERVER_LINK_RELATIONS),
  } as ProcedureFeature;
}

/** Serialize a Procedure input to SensorML-JSON. `position` is never included. */
export function procedureToSml(input: ProcedureInput): SmlProcedure {
  const type = input.processType ?? "SimpleProcess";
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
    classifiers: input.classifiers,
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
    components: input.components,
    connections: input.connections,
    links: withoutRelationLinks(input.links, PROCEDURE_SERVER_LINK_RELATIONS),
  } as unknown as SmlProcedure;
}
