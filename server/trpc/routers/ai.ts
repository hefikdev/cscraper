import { createTRPCRouter, publicProcedure, trpcZod } from "@/server/trpc/trpc";
import { processVoiceTranscript, parseDraftText } from "@/server/ai/geminiClient";

export const aiRouter = createTRPCRouter({
  parseVoice: publicProcedure
    .input(trpcZod.object({ transcript: trpcZod.string() }))
    .mutation(async ({ input }) => {
      const resp = await processVoiceTranscript(input.transcript);
      return resp;
    }),

  parseDraft: publicProcedure
    .input(trpcZod.object({ text: trpcZod.string() }))
    .mutation(async ({ input }) => {
      const resp = await parseDraftText(input.text);
      return resp;
    }),
});
