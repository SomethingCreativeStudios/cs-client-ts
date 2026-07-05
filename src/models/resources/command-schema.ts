import { z } from "zod";
import { AnyComponentSchema } from "../swe/any-component.js";
import { JSONEncodingSchema, TextEncodingSchema, BinaryEncodingSchema } from "../swe/encodings.js";
import { LinkSchema } from "../common/link.js";

/** Schema for control stream content encoded as JSON (`application/json`). */
export const CommandSchemaJsonSchema = z.looseObject({
  commandFormat: z.literal("application/json"),
  parametersSchema: AnyComponentSchema,
  resultSchema: AnyComponentSchema.optional(),
  feasibilityResultSchema: AnyComponentSchema.optional(),
});
export type CommandSchemaJson = z.infer<typeof CommandSchemaJsonSchema>;

const SweCsvEncodingSchema = z.looseObject({
  ...TextEncodingSchema.shape,
  tokenSeparator: z.literal(","),
  blockSeparator: z.literal("\n"),
});

/** Schema for control stream content encoded as SWE Common (JSON/Text/CSV/Binary framing). */
export const CommandSchemaSweSchema = z.union([
  z.looseObject({ commandFormat: z.literal("application/swe+json"), recordSchema: AnyComponentSchema, encoding: JSONEncodingSchema }),
  z.looseObject({ commandFormat: z.literal("application/swe+text"), recordSchema: AnyComponentSchema, encoding: TextEncodingSchema }),
  z.looseObject({ commandFormat: z.literal("application/swe+csv"), recordSchema: AnyComponentSchema, encoding: SweCsvEncodingSchema }),
  z.looseObject({ commandFormat: z.literal("application/swe+binary"), recordSchema: AnyComponentSchema, encoding: BinaryEncodingSchema }),
]);
export type CommandSchemaSwe = z.infer<typeof CommandSchemaSweSchema>;

export const CommandSchemaProtobufSchema = z.looseObject({
  commandFormat: z.literal("application/x-protobuf"),
  messageSchema: z.union([z.string().min(1), LinkSchema]),
});
export type CommandSchemaProtobuf = z.infer<typeof CommandSchemaProtobufSchema>;

const KNOWN_CMD_FORMATS = [
  "application/json",
  "application/swe+json",
  "application/swe+text",
  "application/swe+csv",
  "application/swe+binary",
  "application/x-protobuf",
] as const;

/** Catch-all for vendor/other command encodings not natively decoded by this client. */
export const CommandSchemaAnyOtherSchema = z.looseObject({
  commandFormat: z.string().refine((v) => !(KNOWN_CMD_FORMATS as readonly string[]).includes(v)),
});
export type CommandSchemaAnyOther = z.infer<typeof CommandSchemaAnyOtherSchema>;

/** ControlStream `schema` (GET .../schema?cmdFormat=...): a union discriminated by `commandFormat`. */
export const CommandSchemaDescriptorSchema = z.union([
  CommandSchemaJsonSchema,
  CommandSchemaSweSchema,
  CommandSchemaProtobufSchema,
  CommandSchemaAnyOtherSchema,
]);
export type CommandSchemaDescriptor = z.infer<typeof CommandSchemaDescriptorSchema>;
