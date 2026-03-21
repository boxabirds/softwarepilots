/* ---- Gemini shared infrastructure ---- */

/* ---- Constants ---- */

export const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_UPLOAD_URL =
  "https://generativelanguage.googleapis.com/upload/v1beta/files";
const RETRY_DELAY_MS = 1000;
const MAX_RETRIES = 1;
const DEFAULT_MIME_TYPE = "text/markdown";

/* ---- Types ---- */

export interface GeminiFunctionCallResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        functionCall?: {
          name: string;
          args: Record<string, string>;
        };
        text?: string;
      }>;
    };
  }>;
}

/** Response from chat-tutor tool routing (known tools). */
export interface ChatResponse {
  reply: string;
  on_topic: boolean;
  topic?: string;
  step_answer?: string;
}

/** Generic tool-call result for extensible parsing. */
export interface ToolCallResponse {
  functionCalls: Array<{
    name: string;
    args: Record<string, string>;
  }>;
  textFallback?: string;
}

/** Result from Gemini File API upload. */
interface FileUploadResponse {
  file?: {
    uri: string;
    name: string;
    displayName: string;
    mimeType: string;
  };
}

/* ---- Conversation builder ---- */

export function buildGeminiContents(
  conversation: Array<{ role: "user" | "tutor"; content: string }>,
  newMessage: string,
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

/* ---- Multi-tool response parser ---- */

/**
 * Parses a Gemini function-call response into a ChatResponse.
 *
 * Known tool names (help_with_curriculum, off_topic_detected,
 * provided_step_answer) are routed to their respective fields.
 * Unknown tool names are handled gracefully: their raw args are
 * appended to the reply as JSON so callers can inspect them.
 */
export function parseGeminiToolResponse(
  data: GeminiFunctionCallResponse,
): ChatResponse {
  const parts = data.candidates?.[0]?.content?.parts;

  if (!parts || parts.length === 0) {
    throw new Error("No parts in Gemini response");
  }

  const functionCalls = parts
    .filter((p) => p.functionCall)
    .map((p) => p.functionCall!);

  if (functionCalls.length === 0) {
    // Fallback to text response if no function calls
    const textPart = parts.find((p) => p.text);
    if (textPart?.text) {
      return { reply: textPart.text, on_topic: true };
    }
    throw new Error("No function call in Gemini response");
  }

  let reply = "";
  let onTopic = true;
  let topic: string | undefined;
  let stepAnswer: string | undefined;

  for (const fc of functionCalls) {
    switch (fc.name) {
      case "provided_step_answer":
        stepAnswer = fc.args.answer;
        if (fc.args.coaching) {
          reply = reply
            ? `${reply}\n\n${fc.args.coaching}`
            : fc.args.coaching;
        }
        break;
      case "help_with_curriculum":
        reply = reply
          ? `${reply}\n\n${fc.args.response}`
          : fc.args.response || "I'm not sure how to help with that.";
        topic = fc.args.topic;
        break;
      case "off_topic_detected":
        onTopic = false;
        reply =
          fc.args.redirect_hint ||
          "That's an interesting question, but let's focus on the exercise. What part of the code are you curious about?";
        break;
      default:
        // Unknown tool: return raw args gracefully
        reply = reply
          ? `${reply}\n\n${JSON.stringify(fc.args)}`
          : JSON.stringify(fc.args);
        break;
    }
  }

  if (!reply && stepAnswer) {
    reply = "Got it.";
  }

  if (!reply) {
    reply = "I'm not sure how to help with that.";
  }

  const result: ChatResponse = { reply, on_topic: onTopic };
  if (topic) result.topic = topic;
  if (stepAnswer) result.step_answer = stepAnswer;

  return result;
}

/* ---- Gemini caller with retry logic ---- */

export async function callGeminiWithTools(
  apiKey: string,
  model: string,
  systemPrompt: string,
  contents: Array<{ role: string; parts: Array<{ text: string }> }>,
  tools: Array<{ functionDeclarations: Array<Record<string, unknown>> }>,
  temperature?: number,
): Promise<ChatResponse> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;

      const body: Record<string, unknown> = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        tools,
        toolConfig: {
          functionCallingConfig: { mode: "ANY" },
        },
      };

      if (temperature !== undefined) {
        body.generationConfig = { temperature };
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini ${response.status}: ${errorBody}`);
      }

      const data = (await response.json()) as GeminiFunctionCallResponse;
      return parseGeminiToolResponse(data);
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

/* ---- File upload ---- */

/**
 * Uploads content to the Gemini File API (media.upload).
 * Returns the file URI that can be referenced in generateContent requests.
 */
export async function uploadFile(
  apiKey: string,
  content: string,
  displayName: string,
  mimeType: string = DEFAULT_MIME_TYPE,
): Promise<string> {
  const url = `${GEMINI_UPLOAD_URL}?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": mimeType,
      "X-Goog-Upload-Display-Name": displayName,
    },
    body: content,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini upload ${response.status}: ${errorBody}`);
  }

  const data = (await response.json()) as FileUploadResponse;
  if (!data.file?.uri) {
    throw new Error("No file URI in upload response");
  }

  return data.file.uri;
}

/* ---- Cached file upload ---- */

const fileCache = new Map<string, string>();

/**
 * Returns a cached file URI if one exists for `cacheKey`, otherwise
 * uploads the content via `uploadFile` and caches the result.
 */
export async function getOrUploadFile(
  apiKey: string,
  cacheKey: string,
  content: string,
  displayName: string,
): Promise<string> {
  const cached = fileCache.get(cacheKey);
  if (cached) return cached;

  const uri = await uploadFile(apiKey, content, displayName);
  fileCache.set(cacheKey, uri);
  return uri;
}

/**
 * Clears the in-memory file cache. Useful for testing.
 * @internal
 */
export function _clearFileCache(): void {
  fileCache.clear();
}
