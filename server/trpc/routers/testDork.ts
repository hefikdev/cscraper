import { db } from "@/server/db";
import { publicProcedure, createTRPCRouter, trpcZod } from "@/server/trpc/trpc";


export const testDorkRouter = createTRPCRouter({
  runTestDork: publicProcedure
    .input(
      trpcZod.object({ q: trpcZod.string(), method: trpcZod.string().optional() })
    )
    .mutation(async ({ input }) => {
      // Build query accordingly
      const q = input.q;
      const method = input.method ?? "ALL";

      const queries: { q: string; engine: string }[] = [];
      if (method === "FACEBOOK") {
        queries.push({ q: q, engine: "facebook_profile" });
      } else if (method === "GOOGLE") {
        queries.push({ q: q, engine: "google" });
      } else {
        queries.push({ q: q, engine: "google" });
        queries.push({ q: q, engine: "facebook_profile" });
      }

      const results: any[] = [];
      for (const qq of queries) {
        const url = new URL("https://serpapi.com/search.json");
        url.searchParams.set("engine", qq.engine);
        url.searchParams.set("q", qq.q);
        url.searchParams.set("api_key", process.env.SERPAPI_API_KEY ?? "");
        const resp = await fetch(url.toString());
        if (!resp.ok) continue;
        const json = await resp.json();
        results.push(json);
      }

      return { ok: true, results };
    }),
});
