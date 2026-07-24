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
export const CommandSchemaSweSchema = z.discriminatedUnion("commandFormat", [
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

const KnownCommandSchemaSchema = z.discriminatedUnion("commandFormat", [
  CommandSchemaJsonSchema,
  ...CommandSchemaSweSchema.options,
  CommandSchemaProtobufSchema,
]);

/**
 * ControlStream `schema` (GET .../schema?cmdFormat=...).
 *
 * Routes on `commandFormat` by hand rather than via a single `z.union`/`z.discriminatedUnion`:
 * the catch-all branch (`CommandSchemaAnyOtherSchema`) matches any *unrecognized* format string,
 * which isn't expressible as a literal discriminator. Doing the routing manually also means a
 * payload with a known `commandFormat` that fails validation for some other reason (e.g. a
 * missing nested field) reports that specific nested error instead of Zod's generic "no union
 * member matched" message.
 */
export const CommandSchemaDescriptorSchema: z.ZodType<CommandSchemaDescriptor> = z.custom<CommandSchemaDescriptor>().superRefine((value, ctx) => {
  const commandFormat = (value as { commandFormat?: unknown } | null | undefined)?.commandFormat;
  const isKnownFormat = typeof commandFormat === "string" && (KNOWN_CMD_FORMATS as readonly string[]).includes(commandFormat);
  const result = isKnownFormat ? KnownCommandSchemaSchema.safeParse(value) : CommandSchemaAnyOtherSchema.safeParse(value);
  if (!result.success) {
    for (const issue of result.error.issues) ctx.addIssue(issue as z.core.$ZodSuperRefineIssue);
  }
});
export type CommandSchemaDescriptor = CommandSchemaJson | CommandSchemaSwe | CommandSchemaProtobuf | CommandSchemaAnyOther;
