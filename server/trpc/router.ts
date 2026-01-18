import { createTRPCRouter } from "@/server/trpc/trpc";
import { leadsRouter } from "@/server/trpc/routers/leads";
import { searchJobsRouter } from "@/server/trpc/routers/searchJobs";
import { testDorkRouter } from "@/server/trpc/routers/testDork";
import { aiRouter } from "@/server/trpc/routers/ai";

export const appRouter = createTRPCRouter({
  leads: leadsRouter,
  searchJobs: searchJobsRouter,
  testDork: testDorkRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;
