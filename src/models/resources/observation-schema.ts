import { z } from "zod";
import { AnyComponentSchema } from "../swe/any-component.js";
import { DataRecordComponentSchema } from "../swe/any-component.js";
import { JSONEncodingSchema, TextEncodingSchema, BinaryEncodingSchema } from "../swe/encodings.js";
import { LinkSchema } from "../common/link.js";

/** Schema for datastream content encoded as OM-JSON (`application/json`). */
export const ObservationSchemaJsonSchema = z.looseObject({
  obsFormat: z.literal("application/json"),
  parametersSchema: DataRecordComponentSchema.optional(),
  resultSchema: AnyComponentSchema.optional(),
  resultLink: z.looseObject({ mediaType: z.string() }).optional(),
});
export type ObservationSchemaJson = z.infer<typeof ObservationSchemaJsonSchema>;

const SweCsvEncodingSchema = z.looseObject({
  ...TextEncodingSchema.shape,
  tokenSeparator: z.literal(","),
  blockSeparator: z.literal("\n"),
});

/** Schema for datastream content encoded as SWE Common (JSON/Text/CSV/Binary framing). */
export const ObservationSchemaSweSchema = z.union([
  z.looseObject({ obsFormat: z.literal("application/swe+json"), recordSchema: AnyComponentSchema, encoding: JSONEncodingSchema }),
  z.looseObject({ obsFormat: z.literal("application/swe+text"), recordSchema: AnyComponentSchema, encoding: TextEncodingSchema }),
  z.looseObject({ obsFormat: z.literal("application/swe+csv"), recordSchema: AnyComponentSchema, encoding: SweCsvEncodingSchema }),
  z.looseObject({ obsFormat: z.literal("application/swe+binary"), recordSchema: AnyComponentSchema, encoding: BinaryEncodingSchema }),
]);
export type ObservationSchemaSwe = z.infer<typeof ObservationSchemaSweSchema>;

export const ObservationSchemaProtobufSchema = z.looseObject({
  obsFormat: z.literal("application/x-protobuf"),
  messageSchema: z.union([z.string().min(1), LinkSchema]),
});
export type ObservationSchemaProtobuf = z.infer<typeof ObservationSchemaProtobufSchema>;

const KNOWN_OBS_FORMATS = [
  "application/json",
  "application/swe+json",
  "application/swe+text",
  "application/swe+csv",
  "application/swe+binary",
  "application/x-protobuf",
] as const;

/** Catch-all for vendor/other observation encodings not natively decoded by this client. */
export const ObservationSchemaAnyOtherSchema = z.looseObject({
  obsFormat: z.string().refine((v) => !(KNOWN_OBS_FORMATS as readonly string[]).includes(v)),
});
export type ObservationSchemaAnyOther = z.infer<typeof ObservationSchemaAnyOtherSchema>;

/** Datastream `schema` (GET .../schema?obsFormat=...): a union discriminated by `obsFormat`. */
export const ObservationSchemaDescriptorSchema = z.union([
  ObservationSchemaJsonSchema,
  ObservationSchemaSweSchema,
  ObservationSchemaProtobufSchema,
  ObservationSchemaAnyOtherSchema,
]);
export type ObservationSchemaDescriptor = z.infer<typeof ObservationSchemaDescriptorSchema>;
