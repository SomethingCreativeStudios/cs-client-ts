import { z } from "zod";
import { csFeatureShape, featurePropertiesShape } from "./feature.js";
import { LinkSchema } from "../common/link.js";
import { TimePeriodSchema } from "../common/time.js";
import { AssetTypes } from "../common/uris.js";

const SystemPropertiesSchema = z.looseObject({
  ...featurePropertiesShape,
  assetType: z.enum(AssetTypes).optional(),
  validTime: TimePeriodSchema.optional(),
  "systemKind@link": LinkSchema.optional(),
});

/** A System encoded as GeoJSON. */
export const SystemFeatureSchema = z.looseObject(csFeatureShape(SystemPropertiesSchema));
export type SystemFeature = z.infer<typeof SystemFeatureSchema>;
