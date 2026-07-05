import type { Link } from "../common/link.js";
import type { AnySimpleComponent } from "../swe/any-component.js";
import type { SmlProperty } from "../sensorml/derived-property.js";

/** Property has only one encoding (SensorML-JSON), so its "common model" is a thin, ergonomic view. */
export interface Property {
  sourceEncoding: "sml";
  id?: string;
  uniqueId: string;
  label: string;
  description?: string;
  baseProperty: string;
  objectType?: string;
  statistic?: string;
  qualifiers?: AnySimpleComponent[];
  links?: Link[];
  raw: SmlProperty;
}

export type PropertyInput = Omit<Property, "sourceEncoding" | "id" | "raw">;
