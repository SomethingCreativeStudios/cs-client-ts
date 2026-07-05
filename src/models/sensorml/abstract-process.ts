import { z } from "zod";
import { describedObjectShape, ModeSchema, ObservablePropertySchema, SettingsSchema } from "./described-object.js";
import { AnyComponentSchema, type AnyComponent } from "../swe/any-component.js";
import { XLinkSchema } from "../common/link.js";

/** A named process input/output/parameter slot: either an inline SWE component or an ObservableProperty. */
export type IOComponent = ({ name: string } & AnyComponent) | ({ name: string } & z.infer<typeof ObservablePropertySchema>);

export const IOComponentSchema: z.ZodType<IOComponent> = z.lazy(() =>
  z.union([
    z.looseObject({ name: z.string().min(1) }).and(AnyComponentSchema),
    z.looseObject({ name: z.string().min(1) }).and(ObservablePropertySchema),
  ]),
) as z.ZodType<IOComponent>;

/**
 * Shared shape for SimpleProcess / AggregateProcess / PhysicalComponent / PhysicalSystem
 * (i.e. everything a System or Procedure resource can be). Spread — not `.extend()` — so
 * concrete schemas remain `ZodObject`s for the discriminated union in system.ts/procedure.ts.
 */
export const abstractProcessShape = {
  ...describedObjectShape,
  definition: z.string().optional(),
  typeOf: XLinkSchema.optional(),
  configuration: SettingsSchema.optional(),
  featuresOfInterest: z.array(XLinkSchema).min(1).optional(),
  inputs: z.array(IOComponentSchema).min(1).optional(),
  outputs: z.array(IOComponentSchema).min(1).optional(),
  parameters: z.array(IOComponentSchema).min(1).optional(),
  modes: z.array(ModeSchema).optional(),
};

export const ProcessMethodSchema = z.looseObject({
  algorithm: z.unknown().optional(),
  description: z.string().optional(),
});
export type ProcessMethod = z.infer<typeof ProcessMethodSchema>;
