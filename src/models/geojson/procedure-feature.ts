import { z } from "zod";
import { csFeatureShape, featurePropertiesShape } from "./feature.js";
import { LinkSchema } from "../common/link.js";
import { TimePeriodSchema } from "../common/time.js";

const ProcedurePropertiesSchema = z.looseObject({
  ...featurePropertiesShape,
  validTime: TimePeriodSchema.optional(),
});

/** A Procedure encoded as GeoJSON. Procedures are specifications, not physical
 * instances, so `geometry` is always null. */
export const ProcedureFeatureSchema = z.looseObject({
  ...csFeatureShape(ProcedurePropertiesSchema),
  geometry: z.null().optional(),
  links: z.array(LinkSchema).optional(),
});
export type ProcedureFeature = z.infer<typeof ProcedureFeatureSchema>;
