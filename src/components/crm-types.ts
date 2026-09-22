export type Priority = "high" | "normal" | "low";

export type Channel =
  | "LinkedIn"
  | "WhatsApp"
  | "Email"
  | "Phone"
  | "In person"
  | "Other";

export type Interaction = {
  id: string;
  contact_id: string;
  occurred_at: string;
  channel: Channel | string;
  note: string;
  created_at?: string;
  updated_at?: string;
};

export type Contact = {
  id: string;
  name: string;
  company?: string | null;
  role?: string | null;
  linkedin_url?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  priority: Priority;
  cadence_days: number;
  notes?: string | null;
  last_contacted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  snoozed_until?: string | null;
  next_recommended_at?: string | null;
};

export type Suggestion = Contact & {
  days_since_contact: number | null;
  reason: string;
  latest_interaction?: Interaction | null;
};

export type ContactFormValues = {
  name: string;
  company: string;
  role: string;
  linkedin_url: string;
  email: string;
  phone: string;
  location: string;
  priority: Priority;
  cadence_days: number;
  notes: string;
};

export const channelOptions: Channel[] = [
  "LinkedIn",
  "WhatsApp",
  "Email",
  "Phone",
  "In person",
  "Other",
];

export const priorityLabels: Record<Priority, string> = {
  high: "High",
  normal: "Normal",
  low: "Low",
};
