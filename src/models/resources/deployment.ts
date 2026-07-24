import type { Link } from "../common/link.js";
import type { TimePeriod } from "../common/time.js";
import type { Geometry } from "../common/geometry.js";
import type {
  Term,
  ResponsibleParty,
  ContactLink,
  Document,
  Event,
  LegalConstraint,
} from "../sensorml/described-object.js";
import type { DeployedSystem, NamedDeployedSystem } from "../sensorml/sml-deployment.js";
import type { DeploymentFeature } from "../geojson/deployment-feature.js";
import type { SmlDeployment } from "../sensorml/sml-deployment.js";

/** The common superset model for a Deployment. */
export interface Deployment {
  sourceEncoding: "geojson" | "sml";

  id?: string;
  uniqueId: string;
  label: string;
  description?: string;
  featureType: string;
  validTime: TimePeriod;
  links?: Link[];

  // Server-provided association links promoted from `links`.
  parentDeployment?: Link;
  subdeployments?: Link;
  featuresOfInterest?: Link;
  samplingFeatures?: Link;
  datastreams?: Link;
  controlstreams?: Link;

  // Cross-encoding fields. GeoJSON carries the location as `geometry`; SensorML
  // carries it as `location`, so `location` is the normalized common field.
  location?: Geometry;
  platform?: DeployedSystem;
  deployedSystems?: NamedDeployedSystem[];

  // GeoJSON-only extent retained because it has no SensorML equivalent.
  bbox?: number[];

  // SensorML-only
  lang?: string;
  keywords?: string[];
  identifiers?: Term[];
  classifiers?: Term[];
  legalConstraints?: LegalConstraint[];
  contacts?: (ResponsibleParty | ContactLink)[];
  documents?: Document[];
  history?: Event[];

  raw: DeploymentFeature | SmlDeployment;
}

type DeploymentServerLinkKey =
  | "parentDeployment"
  | "subdeployments"
  | "featuresOfInterest"
  | "samplingFeatures"
  | "datastreams"
  | "controlstreams";

export type DeploymentInput = Omit<Deployment, "sourceEncoding" | "id" | "raw" | DeploymentServerLinkKey>;
