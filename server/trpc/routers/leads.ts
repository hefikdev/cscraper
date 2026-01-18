import { desc, eq, not } from "drizzle-orm";
import { db } from "@/server/db";
import { rawLeads } from "@/server/db/schema";
import { createTRPCRouter, publicProcedure, trpcZod } from "@/server/trpc/trpc";
import { importLead } from "@/server/leads/importLead";
import { categorizeLeadText, verifyLead } from "@/server/ai/geminiClient";
import { publicProcedure as publicP } from "@/server/trpc/trpc";

export const leadsRouter = createTRPCRouter({
  importLead: publicProcedure
    .input(
      trpcZod.object({
        organizationName: trpcZod.string().optional().nullable(),
        category: trpcZod.string().optional().nullable(),
        city: trpcZod.string().optional().nullable(),
        phoneRaw: trpcZod.string().optional().nullable(),
        email: trpcZod.string().optional().nullable(),
        websiteUrl: trpcZod.string().optional().nullable(),
        socialUrl: trpcZod.string().optional().nullable(),
        aiRawSummary: trpcZod.string().optional().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      return importLead(input, "GOOGLE_DORK");
    }),
  list: publicProcedure.query(async () => {
    return db
      .select()
      .from(rawLeads)
      .orderBy(desc(rawLeads.id))
      .limit(20);
  }),

  categorize: publicProcedure
    .input(
      trpcZod.object({
        id: trpcZod.number(),
      })
    )
    .mutation(async ({ input }) => {
      const found = await db
        .select()
        .from(rawLeads)
        .where(eq(rawLeads.id, input.id))
        .limit(1);

      const lead = found[0];
      if (!lead) throw new Error("Lead not found");

      const sourceText =
        lead.aiRawSummary ??
        [lead.organizationName, lead.category, lead.city, lead.websiteUrl, lead.socialUrl]
          .filter(Boolean)
          .join(" \n");

      const categorized = await categorizeLeadText(sourceText);
      const suggested = categorized.data;

      const verification = await verifyLead(sourceText);
      const verificationData = verification.data ?? {};

      const updates: Partial<typeof lead> = {};
      if (suggested.city && suggested.city.trim().length > 0 && suggested.city !== lead.city) {
        updates.city = suggested.city;
      }
      if (suggested.category && suggested.category.trim().length > 0 && suggested.category !== lead.category) {
        updates.category = suggested.category;
      }

      // mark as categorized and set verified if AI says so
      updates.status = "CATEGORIZED";
      if (typeof verificationData.is_real === "boolean") {
        updates.verified = Boolean(verificationData.is_real);
      }

      await db
        .update(rawLeads)
        .set(updates)
        .where(eq(rawLeads.id, input.id));

      const updated = await db
        .select()
        .from(rawLeads)
        .where(eq(rawLeads.id, input.id))
        .limit(1);

      return { ok: true, suggestions: suggested, verification: verificationData, lead: updated[0], model: categorized.modelName };
    }),

  categorizeAll: publicProcedure
    .input(
      trpcZod.object({
        method: trpcZod.string().optional(),
        wojewodztwo: trpcZod.string().optional(),
        city: trpcZod.string().optional(),
        campType: trpcZod.string().optional(),
        category: trpcZod.string().optional(),
      })
      .optional()
    )
    .mutation(async ({ input }) => {
      // Build filter based on optional params
      let pending = await db.select().from(rawLeads).where(not(eq(rawLeads.status, "CATEGORIZED")));

      // If params provided, filter results to those matching the params roughly by city/category
      if (input) {
        if (input.city) {
          pending = pending.filter((l: any) => (l.city ?? "").toLowerCase() === input.city!.toLowerCase());
        }
        if (input.category) {
          pending = pending.filter((l: any) => (l.category ?? "").toLowerCase().includes(input.category!.toLowerCase()));
        }
      }

      const results: Array<{ id: number; categorized: boolean; verified?: boolean; suggestions?: any; model?: string }> = [];

      for (const lead of pending) {
        try {
          const sourceText =
            lead.aiRawSummary ??
            [lead.organizationName, lead.category, lead.city, lead.websiteUrl, lead.socialUrl]
              .filter(Boolean)
              .join(" \n");

          const categorized = await categorizeLeadText(sourceText);
          const suggested = categorized.data;
          const verification = await verifyLead(sourceText);
          const verificationData = verification.data ?? {};

          const updates: Partial<typeof lead> = {} as any;
          let didChange = false;
          if (suggested.city && suggested.city.trim().length > 0 && suggested.city !== lead.city) {
            updates.city = suggested.city;
            didChange = true;
          }
          if (suggested.category && suggested.category.trim().length > 0 && suggested.category !== lead.category) {
            updates.category = suggested.category;
            didChange = true;
          }

          // If lead doesn't fit provided params, assign a group (city-based fallback)
          if (input && input.city && suggested.city && suggested.city.toLowerCase() !== input.city.toLowerCase()) {
            updates.group = `miasto:${suggested.city}`;
          }

          updates.status = "CATEGORIZED";
          if (typeof verificationData.is_real === "boolean") {
            updates.verified = Boolean(verificationData.is_real);
          }

          await db
            .update(rawLeads)
            .set(updates)
            .where(eq(rawLeads.id, lead.id));

          results.push({ id: lead.id, categorized: true, verified: typeof updates.verified === 'boolean' ? updates.verified : undefined, suggestions: suggested, model: categorized.modelName });
        } catch (err) {
          results.push({ id: lead.id, categorized: false });
        }
      }

      return { ok: true, results };
    }),
});
