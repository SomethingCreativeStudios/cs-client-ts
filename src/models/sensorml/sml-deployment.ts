import { z } from "zod";
import { describedObjectShape, SettingsSchema } from "./described-object.js";
import { SoftNamedPropertyShape } from "../swe/basic-types.js";
import { XLinkSchema, LinkSchema } from "../common/link.js";
import { GeometrySchema } from "../common/geometry.js";

export const DeployedSystemSchema = z.looseObject({
  description: z.string().min(1).optional(),
  system: XLinkSchema,
  configuration: SettingsSchema.optional(),
});
export type DeployedSystem = z.infer<typeof DeployedSystemSchema>;

const NamedDeployedSystemSchema = z.looseObject({ ...SoftNamedPropertyShape }).and(DeployedSystemSchema);
export type NamedDeployedSystem = z.infer<typeof NamedDeployedSystemSchema>;

/** A Deployment encoded as SensorML-JSON. */
export const SmlDeploymentSchema = z.looseObject({
  ...describedObjectShape,
  type: z.literal("Deployment"),
  uniqueId: z.string(),
  definition: z.string(),
  location: GeometrySchema.optional(),
  platform: DeployedSystemSchema.optional(),
  deployedSystems: z.array(NamedDeployedSystemSchema).optional(),
  links: z.array(LinkSchema).optional(),
});
export type SmlDeployment = z.infer<typeof SmlDeploymentSchema>;
