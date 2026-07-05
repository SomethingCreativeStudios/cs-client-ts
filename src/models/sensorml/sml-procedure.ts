import { z } from "zod";
import { ProcessMethodSchema } from "./abstract-process.js";
import { physicalProcessShape } from "./physical-process.js";
import {
  SimpleProcessSchema,
  AggregateProcessSchema,
  ComponentListSchema,
  ConnectionListSchema,
  type AggregateProcess,
  type PhysicalComponent,
  type PhysicalSystem,
} from "./processes.js";
import { LinkSchema } from "../common/link.js";

/**
 * A Procedure is structurally the same union as System (see processes.ts), except:
 *  - `definition` is drawn from ProcedureTypeUris rather than SystemTypeUris (both modeled
 *    as `z.string()`, see models/common/uris.ts — not enforced here to allow custom URIs)
 *  - `position` is forbidden: a procedure is a specification, not a physically located instance.
 *    Rebuilt from `physicalProcessShape` without `position` rather than `.omit()`, since the
 *    System variants are `z.lazy`-wrapped (recursive) and don't expose `ZodObject.omit`.
 */
const { position: _omitPosition, ...physicalShapeWithoutPosition } = physicalProcessShape;

/**
 * `looseObject` passes through unrecognized keys, so simply omitting `position`
 * from the shape does not reject an input that supplies one — reject it explicitly.
 */
function rejectPosition<T extends z.ZodType>(schema: T): T {
  return schema.check((ctx) => {
    if (ctx.value && typeof ctx.value === "object" && "position" in ctx.value) {
      ctx.issues.push({
        code: "custom",
        message: "A Procedure is a specification and cannot declare a `position`",
        input: ctx.value,
        path: ["position"],
      });
    }
  }) as unknown as T;
}

export const ProcedurePhysicalComponentSchema = rejectPosition(
  z.looseObject({
    ...physicalShapeWithoutPosition,
    type: z.literal("PhysicalComponent"),
    method: ProcessMethodSchema.optional(),
  }),
);
export type ProcedurePhysicalComponent = z.infer<typeof ProcedurePhysicalComponentSchema>;

export const ProcedurePhysicalSystemSchema: z.ZodType<Omit<PhysicalSystem, "position">> = z.lazy(() =>
  rejectPosition(
    z.looseObject({
      ...physicalShapeWithoutPosition,
      type: z.literal("PhysicalSystem"),
      components: ComponentListSchema.optional(),
      connections: ConnectionListSchema.optional(),
    }),
  ),
) as z.ZodType<Omit<PhysicalSystem, "position">>;

export type AnyProcedure =
  | z.infer<typeof SimpleProcessSchema>
  | AggregateProcess
  | ProcedurePhysicalComponent
  | Omit<PhysicalSystem, "position">;

export const AnyProcedureSchema: z.ZodType<AnyProcedure> = z.union([
  SimpleProcessSchema,
  AggregateProcessSchema,
  ProcedurePhysicalComponentSchema,
  ProcedurePhysicalSystemSchema,
]) as z.ZodType<AnyProcedure>;

export type SmlProcedure = AnyProcedure & {
  definition: string;
  uniqueId: string;
  links?: z.infer<typeof LinkSchema>[];
};

export const SmlProcedureSchema: z.ZodType<SmlProcedure> = AnyProcedureSchema.and(
  z.looseObject({
    definition: z.string(),
    uniqueId: z.string(),
    links: z.array(LinkSchema).optional(),
  }),
) as z.ZodType<SmlProcedure>;
