import { NextResponse } from "next/server";
import { z } from "zod";
import { importLead } from "@/server/leads/importLead";

export const runtime = "nodejs";

const payloadSchema = z.object({
  organization_name: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  phone_raw: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  website_url: z.string().optional().nullable(),
  social_url: z.string().optional().nullable(),
  ai_raw_summary: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await importLead(
    {
      organizationName: parsed.data.organization_name ?? null,
      category: parsed.data.category ?? null,
      city: parsed.data.city ?? null,
      phoneRaw: parsed.data.phone_raw ?? null,
      email: parsed.data.email ?? null,
      websiteUrl: parsed.data.website_url ?? null,
      socialUrl: parsed.data.social_url ?? null,
      aiRawSummary: parsed.data.ai_raw_summary ?? null,
    },
    "GOOGLE_DORK"
  );

  return NextResponse.json({ ok: true, result });
}
