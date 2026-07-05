import { z } from "zod";
import { csFeatureShape, featurePropertiesShape } from "./feature.js";
import { LinkSchema } from "../common/link.js";
import { TimePeriodSchema } from "../common/time.js";

const DeploymentPropertiesSchema = z.looseObject({
  ...featurePropertiesShape,
  validTime: TimePeriodSchema,
  "platform@link": LinkSchema.optional(),
  "deployedSystems@link": z.array(LinkSchema).optional(),
});

/** A Deployment encoded as GeoJSON. */
export const DeploymentFeatureSchema = z.looseObject(csFeatureShape(DeploymentPropertiesSchema));
export type DeploymentFeature = z.infer<typeof DeploymentFeatureSchema>;
