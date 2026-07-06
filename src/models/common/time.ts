import { z } from "zod";

/** ISO-8601 date-time string. */
export const TimeInstantSchema = z.string();
export type TimeInstant = z.infer<typeof TimeInstantSchema>;

/** A time instant, or the literal "now" for an open/rolling bound. */
export const TimeInstantOrNowSchema = z.union([TimeInstantSchema, z.literal("now")]);
export type TimeInstantOrNow = z.infer<typeof TimeInstantOrNowSchema>;

const TimePeriodBoundSchema = z.union([TimeInstantOrNowSchema, z.null()]).transform((value) => value ?? "..");

/** A 2-element [start, end] tuple; either bound may be "now". */
export const TimePeriodSchema = z.preprocess((value) => {
  if (Array.isArray(value) && value.length === 1) return [value[0], ".."];
  return value;
}, z.tuple([TimePeriodBoundSchema, TimePeriodBoundSchema]));
export type TimePeriod = z.infer<typeof TimePeriodSchema>;
