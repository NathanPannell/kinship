import { NextResponse } from "next/server";

const contact = { type: "object", properties: {
  id: { type: "string", format: "uuid" }, name: { type: "string" }, company: { type: ["string", "null"] }, role: { type: ["string", "null"] },
  linkedin_url: { type: ["string", "null"] }, photo_url: { type: ["string", "null"], format: "uri" }, email: { type: ["string", "null"], format: "email" },
  phone: { type: ["string", "null"] }, location: { type: ["string", "null"] }, priority: { type: "string", enum: ["high", "normal", "low"] }, cadence_days: { type: "integer" },
  last_contacted_at: { type: ["string", "null"], format: "date-time" },
} };
const interaction = { type: "object", properties: { id: { type: "string", format: "uuid" }, contact_id: { type: "string", format: "uuid" },
  channel: { type: "string", enum: ["LinkedIn", "WhatsApp", "Email", "Phone", "In person", "Other"] }, note: { type: "string" }, occurred_at: { type: "string", format: "date-time" } } };
const unauthorized = { description: "Missing or invalid bearer token" };
const json = (schema: object) => ({ "application/json": { schema } });
const get = (summary: string, schema: object, parameters?: object[]) => ({ summary, security: [{ bearerAuth: [] }], parameters, responses: { "200": { description: "Success", content: json(schema) }, "401": unauthorized } });

export async function GET(request: Request) {
  const spec = {
    openapi: "3.1.0", info: { title: "Networking CRM agent API", version: "1.0.0", description: "Personal relationship state. Pass the AGENT_API_TOKEN as a Bearer token. The API never sends messages." },
    servers: [{ url: new URL(request.url).origin }],
    components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "opaque" } }, schemas: { Contact: contact, Interaction: interaction } },
    paths: {
      "/api/agent/suggestions": { get: get("Get up to three contacts due today", { type: "object", properties: { suggestions: { type: "array", items: { ...contact, properties: { ...contact.properties, days_since_contact: { type: ["integer", "null"] }, reason: { type: "string" }, latest_interaction: { anyOf: [interaction, { type: "null" }] } } } }, upcoming: { type: "array", items: contact } } }) },
      "/api/agent/contacts": { get: get("Search contacts", { type: "object", properties: { contacts: { type: "array", items: contact } } }, [
        { in: "query", name: "search", schema: { type: "string" } }, { in: "query", name: "priority", schema: { type: "string", enum: ["high", "normal", "low"] } },
        { in: "query", name: "overdue", schema: { type: "boolean" } }, { in: "query", name: "sort", schema: { type: "string", enum: ["last_contacted", "next_due"] } },
      ]) },
      "/api/agent/contacts/{id}": {
        get: get("Get one contact and recent interaction history", { type: "object", properties: { contact, interactions: { type: "array", items: interaction } } }, [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }]),
        patch: {
          summary: "Update contact details or preferences",
          security: [{ bearerAuth: [] }],
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: { required: true, content: json({ type: "object", properties: contact.properties }) },
          responses: { "200": { description: "Updated", content: json({ type: "object", properties: { contact } }) }, "400": { description: "Invalid input" }, "401": unauthorized, "404": { description: "Not found" } },
        },
      },
      "/api/agent/interactions": { post: { summary: "Record an interaction", security: [{ bearerAuth: [] }], requestBody: { required: true, content: json({ type: "object", required: ["contact_id", "channel", "note"], properties: { contact_id: { type: "string", format: "uuid" }, channel: interaction.properties.channel, note: { type: "string" }, occurred_at: { type: "string", format: "date-time" } } }) }, responses: { "201": { description: "Created", content: json({ type: "object", properties: { interaction } }) }, "400": { description: "Invalid input" }, "401": unauthorized } } },
    },
  };
  return NextResponse.json(spec);
}
