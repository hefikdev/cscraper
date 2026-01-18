import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { rawLeads } from "@/server/db/schema";
import { normalizePhone } from "@/server/leads/normalizePhone";

export type RawLeadInput = {
  organizationName?: string | null;
  category?: string | null;
  city?: string | null;
  phoneRaw?: string | null;
  email?: string | null;
  websiteUrl?: string | null;
  socialUrl?: string | null;
  aiRawSummary?: string | null;
};

export async function importLead(input: RawLeadInput, sourceMethod: string) {
  const phoneNormalized = normalizePhone(input.phoneRaw ?? undefined);

  if (!phoneNormalized) {
    return { inserted: false, reason: "MISSING_PHONE" } as const;
  }

  const existing = await db
    .select({ id: rawLeads.id })
    .from(rawLeads)
    .where(eq(rawLeads.phoneNormalized, phoneNormalized))
    .limit(1);

  if (existing.length > 0) {
    return { inserted: false, reason: "DUPLICATE_PHONE" } as const;
  }

  const inserted = await db
    .insert(rawLeads)
    .values({
      organizationName: input.organizationName ?? null,
      category: input.category ?? null,
      city: input.city ?? null,
      phoneRaw: input.phoneRaw ?? null,
      phoneNormalized,
      email: input.email ?? null,
      websiteUrl: input.websiteUrl ?? null,
      socialUrl: input.socialUrl ?? null,
      sourceMethod,
      aiRawSummary: input.aiRawSummary ?? null,
    })
    .returning({ id: rawLeads.id });

  return { inserted: true, id: inserted[0]?.id ?? null } as const;
}
