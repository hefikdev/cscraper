import {
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  integer,
  boolean,
} from "drizzle-orm/pg-core";

export const rawLeads = pgTable("raw_leads", {
  id: serial("id").primaryKey(),
  organizationName: text("organization_name"),
  category: text("category"),
  city: text("city"),
  phoneRaw: text("phone_raw"),
  phoneNormalized: varchar("phone_normalized", { length: 20 }),
  email: text("email"),
  websiteUrl: text("website_url"),
  socialUrl: text("social_url"),
  sourceMethod: varchar("source_method", { length: 50 }),
  aiRawSummary: text("ai_raw_summary"),
  status: varchar("status", { length: 20 }).default("NEW"),
  verified: boolean("verified").default(false),
  group: text("group"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const searchJobs = pgTable("search_jobs", {
  id: serial("id").primaryKey(),
  wojewodztwo: text("wojewodztwo"),
  city: text("city"),
  campType: text("camp_type").notNull(),
  category: text("category").notNull(),
  method: text("method").default("ALL"),
  queryNotes: text("query_notes"),
  requestedBy: text("requested_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const searchJobRuns = pgTable("search_job_runs", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  status: varchar("status", { length: 20 }).default("NEW"),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  logs: text("logs"),
});
