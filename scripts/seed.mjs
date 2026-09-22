import { Client } from "pg";
if (process.env.NODE_ENV === "production") throw new Error("Development seed cannot run in production");
const url = process.env.DEVELOPMENT_DATABASE_URL;
if (!url) throw new Error("Set DEVELOPMENT_DATABASE_URL to a separate development branch");
const client = new Client({ connectionString: url });
await client.connect();
const people = [
  ["Maya Chen", "Northstar Labs", "Engineering Manager", "high", 21, 33, "Met at a reliability meetup. Interested in agent evaluation."],
  ["Daniel Brooks", "Aperture", "Product Lead", "normal", 45, 58, "We discussed developer workflows over coffee."],
  ["Priya Nair", "Cedar", "Founder", "high", 21, 12, "Building tools for small teams."],
  ["Alex Rivera", "Threadline", "Staff Engineer", "normal", 45, 30, "Former teammate. Enjoys systems design conversations."],
  ["Jordan Lee", "Fieldwork", "Design Director", "low", 90, 120, "Connected after a product design event."],
  ["Samira Patel", "Waypoint", "Recruiter", "high", 21, 42, "Discussed senior engineering roles."],
  ["Theo Morgan", "Relay", "Developer Advocate", "normal", 45, 65, "Shared notes on developer communities."],
  ["Elena Torres", "Common Ground", "Founder", "normal", 45, 20, "Interested in community products."],
];
try {
  for (const [name, company, role, priority, cadence, days, notes] of people) {
    await client.query(`INSERT INTO contacts (name,company,role,priority,cadence_days,notes,last_contacted_at)
      SELECT $1,$2,$3,$4,$5,$6,now()-($7::int * interval '1 day')
      WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE name=$1 AND company=$2)`, [name, company, role, priority, cadence, notes, days]);
    await client.query(`INSERT INTO interactions (contact_id, occurred_at, channel, note)
      SELECT c.id, now()-($3::int * interval '1 day'), 'In person', $4
      FROM contacts c WHERE c.name=$1 AND c.company=$2
      AND NOT EXISTS (SELECT 1 FROM interactions i WHERE i.contact_id=c.id)`, [name, company, days, notes]);
  }
  console.log("Development contacts seeded");
} finally { await client.end(); }
