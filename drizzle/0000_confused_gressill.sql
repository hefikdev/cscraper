CREATE TABLE IF NOT EXISTS "raw_leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_name" text,
	"category" text,
	"city" text,
	"phone_raw" text,
	"phone_normalized" varchar(20),
	"email" text,
	"website_url" text,
	"social_url" text,
	"source_method" varchar(50),
	"ai_raw_summary" text,
	"status" varchar(20) DEFAULT 'NEW',
	"verified" boolean DEFAULT false,
	"group" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "search_job_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'NEW',
	"started_at" timestamp,
	"finished_at" timestamp,
	"logs" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "search_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"wojewodztwo" text NOT NULL,
	"city" text NOT NULL,
	"camp_type" text NOT NULL,
	"category" text NOT NULL,
	"method" text DEFAULT 'ALL',
	"query_notes" text,
	"requested_by" text,
	"created_at" timestamp DEFAULT now()
);
