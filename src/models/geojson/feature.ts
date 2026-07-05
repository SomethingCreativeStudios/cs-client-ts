import { z } from "zod";
import { LinkSchema } from "../common/link.js";
import { NullableGeometrySchema } from "../common/geometry.js";

/**
 * Base shape shared by every GeoJSON-encoded CS resource (System, Deployment,
 * Procedure, SamplingFeature). Kept as a factory over a properties schema
 * rather than `.extend()`, mirroring the SensorML shape-spread convention.
 */
export function csFeatureShape<P extends z.ZodType>(propertiesSchema: P) {
  return {
    type: z.literal("Feature"),
    id: z.string().min(1).optional(),
    geometry: NullableGeometrySchema.optional(),
    bbox: z.array(z.number()).optional(),
    properties: propertiesSchema,
    links: z.array(LinkSchema).optional(),
  };
}

export const featurePropertiesShape = {
  featureType: z.string(),
  uid: z.string(),
  name: z.string().min(1),
  description: z.string().min(1).optional(),
};

export const FeaturePropertiesSchema = z.looseObject(featurePropertiesShape);
export const FeatureSchema = z.looseObject(csFeatureShape(FeaturePropertiesSchema));
export type Feature = z.infer<typeof FeatureSchema>;
