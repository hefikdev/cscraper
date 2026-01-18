import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { searchJobs, searchJobRuns } from "../server/db/schema";
import { importLead } from "../server/leads/importLead";
import { env } from "../server/config/envs";
import { extractLeadFromText } from "../server/ai/geminiClient";

type SerpResult = {
  title?: string;
  snippet?: string;
  link?: string;
};

type FacebookProfileResponse = Record<string, unknown>;

const SERPAPI_URL = "https://serpapi.com/search.json";

function parseArgs() {
  const args = new Map<string, string>();
  process.argv.slice(2).forEach((arg) => {
    const [key, value] = arg.split("=");
    if (key && value) {
      args.set(key.replace(/^--/, ""), value);
    }
  });
  return args;
}

function buildDorkQueries({
  city,
  campType,
  category,
  method = "ALL",
}: {
  city: string | null;
  campType: string;
  category: string;
  method?: "ALL" | "FACEBOOK" | "GOOGLE";
}) {
  const phrases = [
    `\"${campType}\"`,
    city ? `\"${city}\"` : null,
    category ? `\"${category}\"` : null,
  ].filter(Boolean);

  const facebookDorks = [
    `site:facebook.com ${phrases.join(" ")} \"telefon\"`,
    `site:facebook.com ${phrases.join(" ")} \"zapisy\"`,
    `site:facebook.com ${phrases.join(" ")} \"wolne miejsca\"`,
  ];

  const googleDorks = [
    `${phrases.join(" ")} \"telefon\"`,
    `${phrases.join(" ")} \"zapisy\"`,
    `${phrases.join(" ")} \"wolne miejsca\"`,
  ];

  if (method === "FACEBOOK") return facebookDorks;
  if (method === "GOOGLE") return googleDorks;
  return [...googleDorks, ...facebookDorks];
}

async function fetchSerpResults(query: string): Promise<SerpResult[]> {
  const url = new URL(SERPAPI_URL);
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", env.SERPAPI_API_KEY);
  url.searchParams.set("num", "10");
  url.searchParams.set("hl", "pl");
  url.searchParams.set("gl", "pl");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`SerpAPI error: ${response.status}`);
  }
  const data = (await response.json()) as {
    organic_results?: SerpResult[];
  };

  return data.organic_results ?? [];
}

function extractFacebookProfileId(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  if (host !== "facebook.com" && !host.endsWith(".facebook.com")) {
    return null;
  }

  if (url.pathname.startsWith("/profile.php")) {
    const id = url.searchParams.get("id");
    return id ? id.trim() : null;
  }

  const [firstSegment] = url.pathname.split("/").filter(Boolean);
  if (!firstSegment) return null;

  const blocked = new Set([
    "pages",
    "groups",
    "events",
    "watch",
    "marketplace",
    "share",
    "reel",
    "photo",
    "photos",
    "stories",
    "story",
    "hashtag",
    "search",
    "posts",
    "permalink",
    "pg",
    "p",
  ]);

  if (blocked.has(firstSegment.toLowerCase())) {
    return null;
  }

  return firstSegment;
}

function collectStrings(value: unknown, output: string[], depth = 0) {
  if (output.length >= 30 || depth > 4) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) output.push(trimmed);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, output, depth + 1);
      if (output.length >= 30) return;
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      collectStrings(entry, output, depth + 1);
      if (output.length >= 30) return;
    }
  }
}

function extractFacebookProfileText(data: FacebookProfileResponse): string | null {
  const strings: string[] = [];
  collectStrings(data, strings);
  const unique = Array.from(new Set(strings));
  const text = unique.join("\n").slice(0, 6000).trim();
  return text.length > 0 ? text : null;
}

async function fetchFacebookProfile(profileId: string): Promise<string | null> {
  const url = new URL(SERPAPI_URL);
  url.searchParams.set("engine", "facebook_profile");
  url.searchParams.set("profile_id", profileId);
  url.searchParams.set("api_key", env.SERPAPI_API_KEY);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`SerpAPI facebook_profile error: ${response.status}`);
  }

  const data = (await response.json()) as FacebookProfileResponse;
  return extractFacebookProfileText(data);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  const args = parseArgs();
  const jobId = args.get("jobId");
  const wojewodztwo = args.get("wojewodztwo");
  const city = args.get("city");
  const campType = args.get("campType") ?? "Półkolonie";
  const category = args.get("category");

  let jobInfo = null as
    | {
        id: number;
        wojewodztwo: string | null;
        city: string | null;
        campType: string;
        category: string;
      }
    | null;

  if (jobId) {
    const found = await db
      .select()
      .from(searchJobs)
      .where(eq(searchJobs.id, Number(jobId)))
      .limit(1);
    jobInfo = found[0] ?? null;
  } else if (category) {
    jobInfo = {
      id: 0,
      wojewodztwo: wojewodztwo ?? "",
      city: city ?? "",
      campType,
      category,
    };
  }

  if (!jobInfo) {
    throw new Error("Missing job parameters (jobId or category)");
  }

  const runLog: string[] = [];
  const runRecord = await db
    .insert(searchJobRuns)
    .values({
      jobId: jobInfo.id,
      status: "RUNNING",
      startedAt: new Date(),
    })
    .returning({ id: searchJobRuns.id });

  const runId = runRecord[0]?.id ?? null;

  process.on("SIGINT", async () => {
    if (runId) {
      await db
        .update(searchJobRuns)
        .set({ status: "STOPPED", finishedAt: new Date(), logs: runLog.join("\n") })
        .where(eq(searchJobRuns.id, runId));
    }
    console.info("Scraper stopped.");
    process.exit(0);
  });

  // Initialization checks: SerpAPI & Gemini
  try {
    // SerpAPI quick check
    const checkUrl = new URL(SERPAPI_URL);
    checkUrl.searchParams.set("engine", "google");
    checkUrl.searchParams.set("q", "site:google.com");
    checkUrl.searchParams.set("api_key", env.SERPAPI_API_KEY);

    const checkResp = await fetch(checkUrl.toString());
    if (checkResp.ok) {
      runLog.push("SerpAPI initialized correctly");
      console.info("SerpAPI initialized correctly");
    } else {
      runLog.push(`SerpAPI initialization failed: ${checkResp.status}`);
      console.warn(`SerpAPI initialization failed: ${checkResp.status}`);
    }
  } catch (err) {
    runLog.push(`SerpAPI initialization failed: ${(err as Error).message}`);
    console.warn("SerpAPI initialization failed:", (err as Error).message);
  }

  try {
    const geminiCheck = (await import("@/server/ai/geminiClient")).testGeminiInitialization();
    if (geminiCheck.ok) {
      runLog.push(`AI Google (Gemini) initialized: ${geminiCheck.modelName}`);
      console.info(`AI Google (Gemini) initialized: ${geminiCheck.modelName}`);
    } else {
      runLog.push(`AI Google (Gemini) initialization failed: ${geminiCheck.error}`);
      console.warn(`AI Google (Gemini) initialization failed: ${geminiCheck.error}`);
    }
  } catch (err) {
    runLog.push(`AI Google (Gemini) initialization failed: ${(err as Error).message}`);
    console.warn("AI Google (Gemini) initialization failed:", (err as Error).message);
  }


  const dorks = buildDorkQueries({
    city: jobInfo.city,
    campType: jobInfo.campType,
    category: jobInfo.category,
    method: (jobInfo as any).method ?? "ALL",
  });

  try {
    for (const dork of dorks) {
      console.info("Query:", dork);
      runLog.push(`Query: ${dork}`);

      const results = await fetchSerpResults(dork);

      for (const result of results) {
        const baseRawText = [result.title, result.snippet, result.link]
          .filter(Boolean)
          .join("\n");
        if (!baseRawText) continue;

        let rawText = baseRawText;
        let sourceMethod = "GOOGLE_DORK";

        // If job asked for Facebook only, try the facebook_profile API when possible
        if (result.link) {
          const profileId = extractFacebookProfileId(result.link);
          if (profileId && (jobInfo as any).method !== "GOOGLE") {
            try {
              const fbText = await fetchFacebookProfile(profileId);
              if (fbText) {
                rawText = [fbText, baseRawText].filter(Boolean).join("\n");
                sourceMethod = "FACEBOOK_PROFILE";
                runLog.push(`Facebook profile enriched: ${profileId}`);
              }
            } catch (error) {
              runLog.push(
                `Facebook profile fetch failed (${profileId}): ${(error as Error).message}`
              );
            }
          }
        }

        let extracted;
        try {
          const geminiResult = await extractLeadFromText(rawText);
          extracted = geminiResult.data;
          runLog.push(`Gemini model: ${geminiResult.modelName}`);
        } catch (error) {
          runLog.push(`Gemini parse failed: ${(error as Error).message}`);
          continue;
        }

        const outcome = await importLead(
          {
            organizationName: extracted.organization_name ?? null,
            category: extracted.category ?? jobInfo.category,
            city: extracted.city ?? jobInfo.city,
            phoneRaw: extracted.phone_raw ?? null,
            email: extracted.email ?? null,
            websiteUrl: extracted.website_url ?? null,
            socialUrl: extracted.social_url ?? result.link ?? null,
            aiRawSummary: rawText,
          },
          sourceMethod
        );

        runLog.push(`Lead: ${outcome.inserted ? "inserted" : outcome.reason}`);
        await sleep(1200);
      }
    }

    if (runId) {
      await db
        .update(searchJobRuns)
        .set({ status: "DONE", finishedAt: new Date(), logs: runLog.join("\n") })
        .where(eq(searchJobRuns.id, runId));
    }

    runLog.push("Scraper finished: SUCCESS");
    console.info("Scraper finished: SUCCESS");
  } catch (error) {
    runLog.push(`Scraper failed: ${(error as Error).message}`);
    console.error("Scraper failed", error);

    if (runId) {
      await db
        .update(searchJobRuns)
        .set({ status: "FAILED", finishedAt: new Date(), logs: runLog.join("\n") })
        .where(eq(searchJobRuns.id, runId));
    }

    process.exit(1);
  }
}

run().catch((error) => {
  console.error("Scraper failed", error);
  process.exit(1);
});
