import { z } from "zod";

const optionalText = z.string().trim().max(2000).optional().nullable().transform((v) => v || null);
const optionalUrl = z.union([z.url().max(2000), z.literal(""), z.null()]).optional().transform((v) => v || null);
export const contactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  company: optionalText,
  role: optionalText,
  linkedin_url: optionalUrl,
  email: z.union([z.email(), z.literal(""), z.null()]).optional().transform((v) => v || null),
  phone: optionalText,
  location: optionalText,
  priority: z.enum(["high", "normal", "low"]).default("normal"),
  cadence_days: z.coerce.number().int().min(1).max(3650).default(45),
  notes: z.string().trim().max(10000).optional().nullable().transform((v) => v || null),
});
export const contactPatchSchema = contactSchema.partial();
export const interactionSchema = z.object({
  contact_id: z.uuid(),
  channel: z.enum(["LinkedIn", "WhatsApp", "Email", "Phone", "In person", "Other"]),
  note: z.string().trim().min(1).max(5000),
  occurred_at: z.iso.datetime({ offset: true }).optional(),
});
export const interactionPatchSchema = interactionSchema.omit({ contact_id: true }).partial();
