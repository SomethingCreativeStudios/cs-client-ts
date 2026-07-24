import type { Link, XLink } from "../common/link.js";
import type { TimePeriod } from "../common/time.js";
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
  Mode,
} from "../sensorml/described-object.js";
import type { IOComponent } from "../sensorml/abstract-process.js";
import type { ComponentListEntry, ConnectionList } from "../sensorml/processes.js";
import type { ProcedureFeature } from "../geojson/procedure-feature.js";
import type { SmlProcedure } from "../sensorml/sml-procedure.js";

/**
 * The common superset model for a Procedure. Procedures share the same underlying
 * structure as Systems (see models/resources/system.ts) but are specifications rather
 * than physical instances, so `position` never appears (see sml-procedure.ts).
 */
export interface Procedure {
  sourceEncoding: "geojson" | "sml";

  id?: string;
  uniqueId: string;
  label: string;
  description?: string;
  featureType: string;
  validTime?: TimePeriod;
  links?: Link[];

  // Server-provided association link promoted from `links`.
  implementingSystems?: Link;

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
  typeOf?: XLink;
  configuration?: Settings;
  featuresOfInterest?: XLink[];
  inputs?: IOComponent[];
  outputs?: IOComponent[];
  parameters?: IOComponent[];
  modes?: Mode[];
  attachedTo?: XLink;
  components?: ComponentListEntry[];
  connections?: ConnectionList;

  raw: ProcedureFeature | SmlProcedure;
}

export type ProcedureInput = Omit<Procedure, "sourceEncoding" | "id" | "raw" | "implementingSystems">;
