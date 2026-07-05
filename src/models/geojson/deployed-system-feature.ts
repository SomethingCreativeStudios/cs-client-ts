import { z } from "zod";
import { LinkSchema } from "../common/link.js";
import { NullableGeometrySchema } from "../common/geometry.js";

const DeployedSystemPropertiesSchema = z.looseObject({
  "system@link": LinkSchema,
  "procedure@link": LinkSchema.optional(),
});

/** A DeployedSystem link record encoded as GeoJSON (used within deployment contexts). */
export const DeployedSystemFeatureSchema = z.looseObject({
  type: z.literal("Feature"),
  id: z.string().min(1).optional(),
  geometry: NullableGeometrySchema.optional(),
  bbox: z.array(z.number()).optional(),
  properties: DeployedSystemPropertiesSchema,
  links: z.array(LinkSchema).optional(),
});
export type DeployedSystemFeature = z.infer<typeof DeployedSystemFeatureSchema>;
