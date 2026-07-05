import { z } from "zod";

/** ISO-8601 date-time string. */
export const TimeInstantSchema = z.string();
export type TimeInstant = z.infer<typeof TimeInstantSchema>;

/** A time instant, or the literal "now" for an open/rolling bound. */
export const TimeInstantOrNowSchema = z.union([TimeInstantSchema, z.literal("now")]);
export type TimeInstantOrNow = z.infer<typeof TimeInstantOrNowSchema>;

/** A 2-element [start, end] tuple; either bound may be "now". */
export const TimePeriodSchema = z.tuple([TimeInstantOrNowSchema, TimeInstantOrNowSchema]);
export type TimePeriod = z.infer<typeof TimePeriodSchema>;
