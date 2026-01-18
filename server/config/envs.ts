import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SERPAPI_API_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  SERPAPI_API_KEY: process.env.SERPAPI_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
});
