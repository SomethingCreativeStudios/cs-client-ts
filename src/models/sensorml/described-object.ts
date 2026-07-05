import { z } from "zod";
import { XLinkSchema } from "../common/link.js";
import { TimePeriodSchema } from "../common/time.js";
import { AnySimpleComponentSchema, VectorComponentSchema, DataArrayComponentSchema } from "../swe/any-component.js";

/** A generic term/classifier/identifier entry (e.g. serial number, process type). */
export const TermSchema = z.looseObject({
  definition: z.string().optional(),
  label: z.string().min(1),
  codeSpace: z.string().optional(),
  value: z.string().min(1),
});
export type Term = z.infer<typeof TermSchema>;

/** A physical property that can be observed, without units of measure (contrast with SWE Quantity). */
export const ObservablePropertySchema = z.looseObject({
  id: z.string().optional(),
  label: z.string().optional(),
  description: z.string().optional(),
  type: z.literal("ObservableProperty"),
  definition: z.string(),
});
export type ObservableProperty = z.infer<typeof ObservablePropertySchema>;

/** Union of the SWE simple/aggregate component kinds usable as a generic "AnyProperty" value. */
export const AnyPropertySchema = z.union([AnySimpleComponentSchema, VectorComponentSchema, DataArrayComponentSchema]);
export type AnyProperty = z.infer<typeof AnyPropertySchema>;

const phoneShape = {
  voice: z.string().optional(),
  facsimile: z.string().optional(),
};
const addressShape = {
  deliveryPoint: z.string().optional(),
  city: z.string().optional(),
  administrativeArea: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  electronicMailAddress: z.string().optional(),
};
export const ResponsiblePartySchema = z.looseObject({
  individualName: z.string().optional(),
  organisationName: z.string().optional(),
  positionName: z.string().optional(),
  contactInfo: z
    .looseObject({
      phone: z.looseObject(phoneShape).optional(),
      address: z.looseObject(addressShape).optional(),
      website: z.string().optional(),
      hoursOfService: z.string().optional(),
      contactInstructions: z.string().optional(),
    })
    .optional(),
  role: z.string(),
});
export type ResponsibleParty = z.infer<typeof ResponsiblePartySchema>;

export const ContactLinkSchema = z.looseObject({
  role: z.string().optional(),
  name: z.string(),
  link: XLinkSchema,
});
export type ContactLink = z.infer<typeof ContactLinkSchema>;

export const DocumentSchema = z.looseObject({
  role: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  link: XLinkSchema,
});
export type Document = z.infer<typeof DocumentSchema>;

const codeListValueShape = { codeSpace: z.string().optional(), value: z.string().optional() };
export const LegalConstraintSchema = z.looseObject({
  useLimitations: z.array(z.string()).optional(),
  accessConstraints: z.array(z.looseObject(codeListValueShape)).optional(),
  useConstraints: z.array(z.looseObject(codeListValueShape)).optional(),
  otherConstraints: z.array(z.string()).optional(),
});
export type LegalConstraint = z.infer<typeof LegalConstraintSchema>;

const settingShape = { ref: z.string() };
export const SettingsSchema = z.looseObject({
  setValues: z
    .array(z.looseObject({ ...settingShape, value: z.union([z.number(), z.string()]) }))
    .min(1)
    .optional(),
  setArrayValues: z
    .array(z.looseObject({ ...settingShape, value: z.array(z.unknown()) }))
    .min(1)
    .optional(),
  setModes: z
    .array(z.looseObject({ ...settingShape, value: z.string() }))
    .min(1)
    .optional(),
  setConstraints: z.array(z.looseObject({ ...settingShape, type: z.string() })).min(1).optional(),
  setStatus: z
    .array(z.looseObject({ ...settingShape, value: z.enum(["enabled", "disabled"]) }))
    .min(1)
    .optional(),
});
export type Settings = z.infer<typeof SettingsSchema>;

/** Mode: a named, pre-configured group of parameter settings. */
export const ModeSchema = z.looseObject({
  type: z.string().optional(),
  id: z.string().optional(),
  description: z.string().optional(),
  uniqueId: z.string().optional(),
  label: z.string().min(1),
  lang: z.string().optional(),
  configuration: SettingsSchema.optional(),
});
export type Mode = z.infer<typeof ModeSchema>;

export const TimeInstantOrPeriodSchema = z.union([z.string(), TimePeriodSchema]);

export const EventSchema = z.looseObject({
  id: z.string().optional(),
  label: z.string().min(1),
  description: z.string().optional(),
  definition: z.string().optional(),
  identifiers: z.array(TermSchema).optional(),
  classifiers: z.array(TermSchema).optional(),
  contacts: z.array(ResponsiblePartySchema).optional(),
  documentation: z.array(DocumentSchema).optional(),
  time: TimeInstantOrPeriodSchema,
  properties: z.array(AnyPropertySchema).optional(),
  configuration: SettingsSchema.optional(),
});
export type Event = z.infer<typeof EventSchema>;

const characteristicOrCapabilityListShape = {
  id: z.string().optional(),
  label: z.string().optional(),
  description: z.string().optional(),
  definition: z.string().optional(),
  conditions: z.array(AnySimpleComponentSchema).optional(),
};
export const CharacteristicListSchema = z.looseObject({
  ...characteristicOrCapabilityListShape,
  characteristics: z.array(AnyPropertySchema),
});
export type CharacteristicList = z.infer<typeof CharacteristicListSchema>;

export const CapabilityListSchema = z.looseObject({
  ...characteristicOrCapabilityListShape,
  capabilities: z.array(AnyPropertySchema),
});
export type CapabilityList = z.infer<typeof CapabilityListSchema>;

/**
 * Shared shape for the base of every SensorML resource (System, Procedure,
 * Deployment, Property all derive from this). Kept as a plain shape object
 * (not `.extend()`) so descendants remain `ZodObject`s for discriminated unions.
 */
export const describedObjectShape = {
  type: z.string(),
  id: z.string().optional(),
  description: z.string().min(1).optional(),
  // Required at the top-level API resource per spec, but real-world inline
  // sub-components (e.g. AggregateProcess.components) often omit it — kept
  // optional here and enforced only where the client constructs top-level resources.
  uniqueId: z.string().optional(),
  label: z.string().min(1),
  lang: z.string().optional(),
  keywords: z.array(z.string().min(1)).optional(),
  identifiers: z.array(TermSchema).optional(),
  classifiers: z.array(TermSchema).optional(),
  validTime: TimePeriodSchema.optional(),
  securityConstraints: z.array(z.looseObject({ type: z.string() })).optional(),
  legalConstraints: z.array(LegalConstraintSchema).optional(),
  characteristics: z.array(CharacteristicListSchema).optional(),
  capabilities: z.array(CapabilityListSchema).optional(),
  contacts: z.array(z.union([ResponsiblePartySchema, ContactLinkSchema])).optional(),
  documents: z.array(DocumentSchema).optional(),
  history: z.array(EventSchema).optional(),
};
