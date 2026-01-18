import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/server/config/envs";

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

const tryModels = [
  "gemini-2.5-flash-lite"
];

let cachedModel: ReturnType<typeof genAI.getGenerativeModel> | null = null;
let cachedModelName = "";

function getModel() {
  if (cachedModel) {
    return { model: cachedModel, modelName: cachedModelName };
  }

  for (const modelName of tryModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      cachedModel = model;
      cachedModelName = modelName;
      return { model, modelName };
    } catch {
      continue;
    }
  }

  throw new Error("No Gemini model available. Check GEMINI_API_KEY.");
}

/**
 * Lightweight test for Gemini availability. Returns the model name when available.
 */
export function testGeminiInitialization(): { ok: true; modelName: string } | { ok: false; error: string } {
  try {
    const { modelName } = getModel();
    return { ok: true, modelName };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type GeminiExtract = {
  organization_name?: string;
  category?: string;
  city?: string;
  phone_raw?: string;
  email?: string;
  website_url?: string;
  social_url?: string;
};

export async function extractLeadFromText(rawText: string) {
  const { model, modelName } = getModel();
  const prompt =
    "Wyciągnij dane kontaktowe z tekstu. Zwróć WYŁĄCZNIE poprawny JSON w formacie: {\"organization_name\":\"\",\"category\":\"\",\"city\":\"\",\"phone_raw\":\"\",\"email\":\"\",\"website_url\":\"\",\"social_url\":\"\"}. Jeśli brak pola, pozostaw pusty string. Tekst wejściowy: " +
    rawText;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  if (!text || text.trim().length === 0) {
    throw new Error("Gemini returned empty response");
  }

  let jsonText = text.trim();
  if (jsonText.startsWith("```json") && jsonText.endsWith("```")) {
    jsonText = jsonText.slice(7, -3).trim();
  } else if (jsonText.startsWith("```") && jsonText.endsWith("```")) {
    jsonText = jsonText.slice(3, -3).trim();
  }

  try {
    return { data: JSON.parse(jsonText) as GeminiExtract, modelName };
  } catch {
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Gemini response not JSON");
    }
    return { data: JSON.parse(jsonMatch[0]) as GeminiExtract, modelName };
  }
}

/**
 * Categorize a lead's text and return suggested category and city.
 */
export async function categorizeLeadText(rawText: string) {
  const { model, modelName } = getModel();
  const prompt =
    `Sprawdź poniższy tekst i zasugeruj najlepszą wartość dla pól "category" (kategoria) i "city" (miejscowość).
Jeśli nie potrafisz zdecydować, pozostaw pusty string dla danego pola.
Zwróć WYŁĄCZNIE JSON w formacie: {"category":"","city":""}.
Tekst: ${rawText}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  if (!text || text.trim().length === 0) {
    throw new Error("Gemini returned empty response");
  }

  let jsonText = text.trim();
  if (jsonText.startsWith("```json") && jsonText.endsWith("```")) {
    jsonText = jsonText.slice(7, -3).trim();
  } else if (jsonText.startsWith("```") && jsonText.endsWith("```")) {
    jsonText = jsonText.slice(3, -3).trim();
  }

  try {
    const parsed = JSON.parse(jsonText) as { category?: string; city?: string };
    return { data: parsed, modelName };
  } catch {
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Gemini response not JSON");
    const parsed = JSON.parse(jsonMatch[0]) as { category?: string; city?: string };
    return { data: parsed, modelName };
  }
}

/**
 * Verify lead information: ask AI whether the organization and data look real.
 * Returns { is_real: boolean, reason?: string, confidence?: number }
 */
export async function verifyLead(rawText: string) {
  const { model, modelName } = getModel();
  const prompt =
    `Sprawdź, czy poniższe informacje o organizatorze wyglądają na prawdziwe (czy organizator istnieje i dane kontaktowe są prawdopodobne).
Zwróć WYŁĄCZNIE JSON w postaci: {"is_real": true|false, "confidence": 0-1, "reason":"krótki opis"}.
Tekst: ${rawText}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  if (!text || text.trim().length === 0) {
    throw new Error("Gemini returned empty response");
  }

  let jsonText = text.trim();
  if (jsonText.startsWith("```json") && jsonText.endsWith("```")) {
    jsonText = jsonText.slice(7, -3).trim();
  } else if (jsonText.startsWith("```") && jsonText.endsWith("```")) {
    jsonText = jsonText.slice(3, -3).trim();
  }

  try {
    const parsed = JSON.parse(jsonText) as { is_real?: boolean; confidence?: number; reason?: string };
    return { data: parsed, modelName };
  } catch {
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Gemini response not JSON");
    const parsed = JSON.parse(jsonMatch[0]) as { is_real?: boolean; confidence?: number; reason?: string };
    return { data: parsed, modelName };
  }
}

/**
 * Process a voice transcript using the exact CRM assistant prompt provided.
 * Returns the parsed actions JSON as returned by Gemini.
 */
export async function processVoiceTranscript(transcript: string) {
  const { model, modelName } = getModel();
  const prompt = `
You are a CRM assistant for a Polish summer camp business. Analyze the following voice transcript and execute direct commands for the CRM system.

IMPORTANT CONTEXT:
- This CRM manages potential summer camp HOSTS (organizatorzy obozów)
- Use Polish terms: host, klient, organizator, prowadzący, właściciel, firma
- NEVER use "lead" - it gets confused with "Lidl" (Polish supermarket)
- Commands should be direct and action-oriented
- Focus on command execution, not conversational analysis

Possible actions:
- navigate: Navigate to a specific page (e.g., "lead-form", "leads", "dashboard", "events")
- create_lead: Create a new host/organizer with provided data
- update_lead: Update an existing host/organizer
- create_event: Create a contact event (phone_call, meeting, email, visit, social_media)

Output your response as a valid JSON object with an "actions" array. Each action should have a "type" field and additional fields as needed.

IMPORTANT: Return ONLY the raw JSON object, without any markdown formatting, code blocks, or additional text.

Direct command examples:

Navigation commands:
"Dodaj nowego klienta" → {"actions": [{"type": "navigate", "page": "lead-form"}]}
"Pokaż wszystkich klientów" → {"actions": [{"type": "navigate", "page": "leads"}]}
"Przejdź do dashboard" → {"actions": [{"type": "navigate", "page": "dashboard"}]}
"Pokaż zdarzenia" → {"actions": [{"type": "navigate", "page": "events"}]}

Host/Organizer creation commands:
"Dodaj klienta firma ABC" → {"actions": [{"type": "create_lead", "data": {"company": "ABC"}}]}
"Dodaj klienta Jan Kowalski firma XYZ" → {"actions": [{"type": "create_lead", "data": {"company": "XYZ", "contactPerson": "Jan Kowalski"}}]}
"Dodaj organizatora firma DEF" → {"actions": [{"type": "create_lead", "data": {"company": "DEF"}}]}

Event creation commands:
"Dodaj zdarzenie telefon do firmy ABC" → {"actions": [{"type": "create_event", "data": {"type": "telefon", "notes": "Rozmowa z firmą ABC"}}]}
"Dodaj zdarzenie spotkanie z Janem Kowalskim" → {"actions": [{"type": "create_event", "data": {"type": "spotkanie", "notes": "Spotkanie z Janem Kowalskim"}}]}
"Dodaj zdarzenie email do organizatora XYZ" → {"actions": [{"type": "create_event", "data": {"type": "email", "notes": "Email do organizatora XYZ"}}]}
"Dodaj zdarzenie wizyta u firmy ABC" → {"actions": [{"type": "create_event", "data": {"type": "wizyta", "notes": "Wizyta u firmy ABC"}}]}
"Dodaj zdarzenie social media Facebook" → {"actions": [{"type": "create_event", "data": {"type": "social", "notes": "Kontakt przez Facebook"}}]}

Combined commands:
"Dodaj klienta firma ABC i dodaj zdarzenie telefon" → {"actions": [{"type": "create_lead", "data": {"company": "ABC"}}, {"type": "create_event", "data": {"type": "telefon", "notes": "Rozmowa z firmą ABC"}}]}

Transcript: "${transcript}"
`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  if (!text || text.trim().length === 0) {
    throw new Error("Gemini returned empty response");
  }

  let jsonText = text.trim();
  if (jsonText.startsWith("```json") && jsonText.endsWith("```")) {
    jsonText = jsonText.slice(7, -3).trim();
  } else if (jsonText.startsWith("```") && jsonText.endsWith("```")) {
    jsonText = jsonText.slice(3, -3).trim();
  }

  try {
    const parsed = JSON.parse(jsonText);
    return { data: parsed, modelName };
  } catch (err) {
    // If model returned surrounding text, try to extract JSON object
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Gemini response not JSON: " + jsonText.slice(0, 300));
    const parsed = JSON.parse(jsonMatch[0]);
    return { data: parsed, modelName };
  }
}

/**
 * Parse a free-form draft text and extract structured lead information.
 */
export async function parseDraftText(text: string) {
  const { model, modelName } = getModel();
  console.log(`Using Gemini model: ${modelName} for draft text parsing`);
  console.log('Draft text:', text);

  const prompt = `Analyze the following text from social media, websites, or other sources and extract lead information for a CRM system.

Return ONLY a valid JSON object with these exact fields (use empty string "" for missing values):
{
  "company": "company/organization name",
  "contactPerson": "contact person name",
  "email": "email address",
  "phone": "phone number",
  "website": "website URL",
  "facebookProfile": "Facebook profile/page URL",
  "miejscowosc": "city/town name",
  "wojewodztwo": "voivodeship/region name",
  "nip": "Polish tax ID number",
  "notes": "any additional notes or description",
  "priceRange": "price range if mentioned (e.g., '500-1000')",
  "hostType": "array of hosting types like ['połkolonie', 'obozy'] or empty array",
  "hostSize": "size indicator like 'S', 'M', 'L'",
  "tags": "array of relevant CRM tags from this exact list only: #klubsportowy, #jezdzieckie, #osir, #zhp, #pilkanozna, #biuro, #taniec, #karate, #jezykowe, #plywanie, #szkolaniepubliczna, #strazacy. Use existing tags with priority - for example if you detect language-related content, use '#jezykowe' not '#jezykowy'. Only include tags that clearly match the organization's activities. Do not create generic tags like 'oboz', 'summer', 'kids', etc.'"
}

Text to analyze: "${text}"

Important: Return only the JSON object, no markdown formatting or additional text.`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const rawResponse = response.text();
  console.log('AI Raw Response:', rawResponse);

  if (!rawResponse || rawResponse.trim().length === 0) {
    throw new Error("AI returned empty response");
  }

  let jsonText = rawResponse.trim();
  if (jsonText.startsWith('```json') && jsonText.endsWith('```')) {
    jsonText = jsonText.slice(7, -3).trim();
  } else if (jsonText.startsWith('```') && jsonText.endsWith('```')) {
    jsonText = jsonText.slice(3, -3).trim();
  }

  try {
    const parsed = JSON.parse(jsonText);
    console.log('Successfully parsed JSON:', parsed);
    return { suggestions: parsed, modelName };
  } catch (parseError) {
    console.error("Failed to parse AI response as JSON:", jsonText);
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`AI response was not valid JSON. Raw response: ${jsonText.substring(0, 200)}...`);
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return { suggestions: parsed, modelName };
  }
}
