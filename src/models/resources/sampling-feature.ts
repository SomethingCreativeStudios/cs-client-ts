import type { Link } from "../common/link.js";
import type { TimePeriod } from "../common/time.js";
import type { Geometry } from "../common/geometry.js";
import type { SamplingFeatureGeoJson as SamplingFeatureWire } from "../geojson/sampling-feature.js";

/** Sampling Feature has only one encoding (GeoJSON), so its "common model" is a thin, ergonomic view. */
export interface SamplingFeature {
  sourceEncoding: "geojson";
  id?: string;
  uniqueId: string;
  label: string;
  description?: string;
  featureType: string;
  validTime?: TimePeriod;
  geometry?: Geometry | null;
  bbox?: number[];
  sampledFeatureLink: Link;
  links?: Link[];

  // Server-provided association links promoted from `links`.
  parentSystem?: Link;
  sampleOf?: Link;
  datastreams?: Link;
  controlstreams?: Link;

  raw: SamplingFeatureWire;
}

type SamplingFeatureServerLinkKey = "parentSystem" | "sampleOf" | "datastreams" | "controlstreams";

export type SamplingFeatureInput = Omit<SamplingFeature, "sourceEncoding" | "id" | "raw" | SamplingFeatureServerLinkKey>;
