import type { Contact, ContactFormValues, Priority } from "./crm-types";

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export function formatDate(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value?: string | null) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function relativeContactDate(value?: string | null) {
  if (!value) return "Never contacted";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export function nextDueDate(contact: Contact) {
  if (!contact.last_contacted_at) return "Ready to start";
  const due = new Date(contact.last_contacted_at);
  due.setDate(due.getDate() + contact.cadence_days);
  return formatDate(due.toISOString());
}

export function priorityClass(priority: Priority) {
  return `priority-badge priority-${priority}`;
}

export function emptyContactForm(): ContactFormValues {
  return {
    name: "",
    company: "",
    role: "",
    linkedin_url: "",
    email: "",
    phone: "",
    location: "",
    priority: "normal",
    cadence_days: 45,
    notes: "",
  };
}

export function contactToForm(contact: Contact): ContactFormValues {
  return {
    name: contact.name,
    company: contact.company ?? "",
    role: contact.role ?? "",
    linkedin_url: contact.linkedin_url ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    location: contact.location ?? "",
    priority: contact.priority,
    cadence_days: contact.cadence_days,
    notes: contact.notes ?? "",
  };
}

export async function apiRequest<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body.error === "string" ? body.error : "Something went wrong.";
    throw new Error(message);
  }
  return body as T;
}
