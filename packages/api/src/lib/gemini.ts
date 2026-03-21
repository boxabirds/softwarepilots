/* ---- Constants ---- */

const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";
const RETRY_DELAY_MS = 1000;
const MAX_RETRIES = 1;

/* ---- Types ---- */

export interface GeminiFunctionCall {
  name: string;
  args: Record<string, string>;
}

export interface GeminiFunctionCallResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        functionCall?: GeminiFunctionCall;
        text?: string;
      }>;
    };
  }>;
}

export interface GeminiToolDeclaration {
  functionDeclarations: Array<Record<string, unknown>>;
}

/* ---- Conversation builder ---- */

export function buildGeminiContents(
  conversation: Array<{ role: "user" | "tutor"; content: string }>,
  newMessage: string
): Array<{ role: string; parts: Array<{ text: string }> }> {
  const contents: Array<{
    role: string;
    parts: Array<{ text: string }>;
  }> = [];

  for (const msg of conversation) {
    contents.push({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    });
  }

  contents.push({ role: "user", parts: [{ text: newMessage }] });

  return contents;
}

/* ---- Raw Gemini caller ---- */

export interface CallGeminiOptions {
  apiKey: string;
  model?: string;
  systemPrompt: string;
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  tools: GeminiToolDeclaration[];
  temperature?: number;
}

/**
 * Calls Gemini with forced function calling and returns the raw response.
 * Retries once on transient failures.
 */
export async function callGeminiRaw(
  options: CallGeminiOptions
): Promise<GeminiFunctionCallResponse> {
  const {
    apiKey,
    model = DEFAULT_GEMINI_MODEL,
    systemPrompt,
    contents,
    tools,
    temperature = 0.4,
  } = options;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          tools,
          toolConfig: {
            functionCallingConfig: { mode: "ANY" },
          },
          generationConfig: { temperature },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini ${response.status}: ${errorBody}`);
      }

      return (await response.json()) as GeminiFunctionCallResponse;
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      throw err;
    }
  }

  throw new Error("Unreachable");
}

/* ---- Tool response extraction ---- */

/**
 * Extracts function calls from a Gemini response.
 * Returns an array of function calls, or falls back to text.
 */
export function extractGeminiFunctionCalls(
  data: GeminiFunctionCallResponse
): { functionCalls: GeminiFunctionCall[]; fallbackText?: string } {
  const parts = data.candidates?.[0]?.content?.parts;

  if (!parts || parts.length === 0) {
    throw new Error("No parts in Gemini response");
  }

  const functionCalls = parts
    .filter((p) => p.functionCall)
    .map((p) => p.functionCall!);

  if (functionCalls.length === 0) {
    const textPart = parts.find((p) => p.text);
    return { functionCalls: [], fallbackText: textPart?.text };
  }

  return { functionCalls };
}

/* ---- File upload placeholder ---- */

/**
 * Uploads a file to the Gemini Files API if not already cached.
 * Returns the file URI for use in prompts.
 *
 * Note: For now, this is a placeholder that returns a descriptive reference.
 * Full implementation will use the Gemini Files API for large curriculum docs.
 */
export async function getOrUploadFile(
  _apiKey: string,
  _filePath: string,
  _displayName: string
): Promise<string> {
  // Placeholder — curriculum content is inlined in the system prompt for now
  return `[file: ${_displayName}]`;
}
