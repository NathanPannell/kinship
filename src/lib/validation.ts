import { z } from "zod";

const optionalText = z.string().trim().max(2000).optional().nullable().transform((v) => v || null);
const optionalUrl = z.union([z.url().max(2000), z.literal(""), z.null()]).optional().transform((v) => v || null);
const optionalHttpsUrl = optionalUrl.refine((v) => !v || v.startsWith("https://"), "Photo URLs must use HTTPS");
export const contactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  company: optionalText,
  role: optionalText,
  linkedin_url: optionalUrl,
  photo_url: optionalHttpsUrl,
  email: z.union([z.email(), z.literal(""), z.null()]).optional().transform((v) => v || null),
  phone: optionalText,
  location: optionalText,
  priority: z.enum(["high", "normal", "low"]).default("normal"),
  cadence_days: z.coerce.number().int().min(1).max(3650).default(45),
  notes: z.string().trim().max(10000).optional().nullable().transform((v) => v || null),
});
export const agentContactCreateSchema = contactSchema.extend({
  priority: z.enum(["high", "normal", "low"]).default("low"),
  cadence_days: z.coerce.number().int().min(1).max(3650).default(60),
});
export const contactPatchSchema = contactSchema.partial();
const bulkContactIds = z.array(z.uuid()).min(1).max(10000).refine(
  (ids) => new Set(ids).size === ids.length,
  "Contact IDs must be unique",
);
export const bulkContactUpdateSchema = z.strictObject({
  ids: bulkContactIds,
  updates: z.strictObject({
    priority: z.enum(["high", "normal", "low"]).optional(),
    cadence_days: z.number().int().min(1).max(3650).optional(),
  }).refine((updates) => updates.priority !== undefined || updates.cadence_days !== undefined, "Provide a priority or cadence"),
});
export const bulkContactDeleteSchema = z.strictObject({ ids: bulkContactIds });
export const deleteAllContactsSchema = z.strictObject({ confirmation: z.literal("DELETE_ALL_CONTACTS") });
export const interactionSchema = z.object({
  contact_id: z.uuid(),
  channel: z.enum(["LinkedIn", "WhatsApp", "Email", "Phone", "In person", "Other"]),
  note: z.string().trim().min(1).max(5000),
  occurred_at: z.iso.datetime({ offset: true }).optional(),
});
export const interactionPatchSchema = interactionSchema.omit({ contact_id: true }).partial();
