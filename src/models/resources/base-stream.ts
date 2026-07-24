import { z } from "zod";
import { TimePeriodSchema } from "../common/time.js";
import { LinkSchema } from "../common/link.js";

type StreamSchemaFormatKey = "obsFormat" | "commandFormat";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Normalize tolerated response omissions without relaxing create/update input
 * validation. Some Part 2 implementations omit required nullable/read-only
 * values and echo the write-only schema used at creation time.
 */
export function normalizeStreamResponse(
  value: unknown,
  formatKey: StreamSchemaFormatKey,
  nullableFields: readonly string[],
  isValidEmbeddedSchema: (schema: unknown) => boolean,
  defaults: Readonly<Record<string, unknown>> = {},
): unknown {
  if (!isRecord(value)) return value;

  const normalized = { ...value };
  const embeddedSchema = normalized.schema;

  if (
    normalized.formats === undefined
    && isRecord(embeddedSchema)
    && typeof embeddedSchema[formatKey] === "string"
  ) {
    normalized.formats = [embeddedSchema[formatKey]];
  }

  for (const field of nullableFields) {
    if (normalized[field] === undefined) normalized[field] = null;
  }

  for (const [field, defaultValue] of Object.entries(defaults)) {
    if (normalized[field] === undefined) normalized[field] = defaultValue;
  }

  // `schema` is write-only in stream responses. Preserve a valid echoed value
  // for callers that can use it, but do not let a malformed echo invalidate an
  // otherwise usable stream. The dedicated schema endpoint remains strict.
  if (embeddedSchema !== undefined && !isValidEmbeddedSchema(embeddedSchema)) {
    delete normalized.schema;
  }

  return normalized;
}

/** Shared response shape between DataStream and ControlStream. */
export const baseStreamShape = {
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  validTime: TimePeriodSchema.optional(),
  formats: z.array(z.string()).min(1),
};

/** Shared write payload shape; read-only response fields stay optional here. */
export const baseStreamInputShape = {
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  validTime: TimePeriodSchema.optional(),
  formats: z.array(z.string()).min(1).optional(),
};

export const ObservedOrControlledPropertySchema = z.looseObject({
  definition: z.string(),
  label: z.string().optional(),
  description: z.string().optional(),
});
export type ObservedOrControlledProperty = z.infer<typeof ObservedOrControlledPropertySchema>;

export const StreamLinksShape = {
  links: z.array(LinkSchema).optional(),
};
