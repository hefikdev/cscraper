import { initTRPC } from "@trpc/server";
import { z } from "zod";
import type { TRPCContext } from "@/server/trpc/context";

const t = initTRPC.context<TRPCContext>().create();

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const trpcZod = z;
