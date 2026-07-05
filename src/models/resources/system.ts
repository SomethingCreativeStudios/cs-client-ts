import type { Link, XLink } from "../common/link.js";
import type { TimePeriod } from "../common/time.js";
import type { Geometry } from "../common/geometry.js";
import type { AssetType } from "../common/uris.js";
import type {
  Term,
  Settings,
  CharacteristicList,
  CapabilityList,
  ResponsibleParty,
  ContactLink,
  Document,
  Event,
  LegalConstraint,
} from "../sensorml/described-object.js";
import type { IOComponent } from "../sensorml/abstract-process.js";
import type { Mode } from "../sensorml/described-object.js";
import type { Position, SpatialFrame, TemporalFrame } from "../sensorml/physical-process.js";
import type { ComponentListEntry, ConnectionList } from "../sensorml/processes.js";
import type { SystemFeature } from "../geojson/system-feature.js";
import type { SmlSystem } from "../sensorml/sml-system.js";

/**
 * The common superset model for a System: every field either encoding can carry.
 * Fields absent in the encoding a given instance was fetched from are `undefined`.
 * `sourceEncoding`/`raw` let callers recover exactly what the server sent.
 */
export interface System {
  sourceEncoding: "geojson" | "sml";

  // Shared identity (present regardless of encoding)
  id?: string;
  uniqueId: string;
  label: string;
  description?: string;
  featureType: string;
  validTime?: TimePeriod;
  links?: Link[];
  /** System kind, normalized to the SensorML `typeOf` name even when read from GeoJSON `systemKind@link`. */
  typeOf?: XLink;

  // Cross-encoding fields. GeoJSON carries the location as `geometry`; SensorML
  // carries it as `position`, so `position` is the normalized common field.
  assetType?: AssetType | string;
  position?: Position;

  // GeoJSON wire details retained for round-tripping/debugging.
  geometry?: Geometry | null;
  bbox?: number[];

  // SensorML-only
  processType?: "SimpleProcess" | "AggregateProcess" | "PhysicalComponent" | "PhysicalSystem";
  lang?: string;
  keywords?: string[];
  identifiers?: Term[];
  classifiers?: Term[];
  securityConstraints?: { type: string }[];
  legalConstraints?: LegalConstraint[];
  characteristics?: CharacteristicList[];
  capabilities?: CapabilityList[];
  contacts?: (ResponsibleParty | ContactLink)[];
  documents?: Document[];
  history?: Event[];
  configuration?: Settings;
  featuresOfInterest?: XLink[];
  inputs?: IOComponent[];
  outputs?: IOComponent[];
  parameters?: IOComponent[];
  modes?: Mode[];
  attachedTo?: XLink;
  localReferenceFrames?: SpatialFrame[];
  localTimeFrames?: TemporalFrame[];
  components?: ComponentListEntry[];
  connections?: ConnectionList;

  raw: SystemFeature | SmlSystem;
}

/** Fields a caller may set when creating/updating a System, independent of target encoding. */
export type SystemInput = Omit<System, "sourceEncoding" | "id" | "raw">;
