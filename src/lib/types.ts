export type Priority = "high" | "normal" | "low";
export type Channel = "LinkedIn" | "WhatsApp" | "Email" | "Phone" | "In person" | "Other";

export type Contact = {
  id: string;
  name: string;
  company: string | null;
  role: string | null;
  linkedin_url: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  priority: Priority;
  cadence_days: number;
  notes: string | null;
  last_contacted_at: string | null;
  snoozed_until: string | null;
  created_at: string;
  updated_at: string;
};

export type Interaction = {
  id: string;
  contact_id: string;
  occurred_at: string;
  channel: Channel;
  note: string;
  created_at: string;
  updated_at: string;
};

export type Suggestion = Contact & {
  days_since_contact: number | null;
  next_recommended_at: string | null;
  reason: string;
  latest_interaction: Interaction | null;
};
