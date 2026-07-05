import type { Property, PropertyInput } from "../models/resources/property.js";
import type { SmlProperty } from "../models/sensorml/derived-property.js";

export function propertyFromSml(doc: SmlProperty): Property {
  return {
    sourceEncoding: "sml",
    id: doc.id,
    uniqueId: doc.uniqueId,
    label: doc.label,
    description: doc.description,
    baseProperty: doc.baseProperty,
    objectType: doc.objectType,
    statistic: doc.statistic,
    qualifiers: doc.qualifiers,
    links: doc.links,
    raw: doc,
  };
}

export function propertyToSml(input: PropertyInput): SmlProperty {
  return {
    uniqueId: input.uniqueId,
    label: input.label,
    description: input.description,
    baseProperty: input.baseProperty,
    objectType: input.objectType,
    statistic: input.statistic,
    qualifiers: input.qualifiers,
    links: input.links,
  } as SmlProperty;
}
