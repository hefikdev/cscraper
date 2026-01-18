import { desc } from "drizzle-orm";
import { db } from "@/server/db";
import { searchJobs } from "@/server/db/schema";
import { createTRPCRouter, publicProcedure, trpcZod } from "@/server/trpc/trpc";

export const searchJobsRouter = createTRPCRouter({
  create: publicProcedure
    .input(
      trpcZod.object({
        wojewodztwo: trpcZod.string().optional().nullable(),
        city: trpcZod.string().optional().nullable(),
        campType: trpcZod.string().min(2),
        category: trpcZod.string().min(2),
        queryNotes: trpcZod.string().optional().nullable(),
        method: trpcZod.string().optional().default("ALL"),
        requestedBy: trpcZod.string().optional().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const inserted = await db
        .insert(searchJobs)
        .values({
          wojewodztwo: input.wojewodztwo ?? null,
          city: input.city ?? null,
          campType: input.campType,
          category: input.category,
          method: input.method ?? "ALL",
          queryNotes: input.queryNotes ?? null,
          requestedBy: input.requestedBy ?? null,
        })
        .returning({ id: searchJobs.id });
      return { id: inserted[0]?.id ?? null };
    }),
  list: publicProcedure.query(async () => {
    return db.select().from(searchJobs).orderBy(desc(searchJobs.id)).limit(20);
  }),
});
