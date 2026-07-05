import { z } from "zod";
import { csFeatureShape, featurePropertiesShape } from "./feature.js";
import { LinkSchema } from "../common/link.js";
import { TimePeriodSchema } from "../common/time.js";

const SamplingFeaturePropertiesSchema = z.looseObject({
  ...featurePropertiesShape,
  validTime: TimePeriodSchema.optional(),
  "sampledFeature@link": LinkSchema,
});

/**
 * A Sampling Feature encoded as GeoJSON (its only encoding — no SensorML form exists).
 * Named `...GeoJson` (rather than `SamplingFeatureFeature`) to avoid colliding with
 * the common superset model `SamplingFeature` in models/resources/sampling-feature.ts.
 */
export const SamplingFeatureGeoJsonSchema = z.looseObject(csFeatureShape(SamplingFeaturePropertiesSchema));
export type SamplingFeatureGeoJson = z.infer<typeof SamplingFeatureGeoJsonSchema>;
