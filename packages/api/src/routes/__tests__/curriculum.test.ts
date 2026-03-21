import { describe, it, expect, mock, beforeEach } from "bun:test";
import { Hono } from "hono";
import { isValidProfile, isValidSectionId, curriculum } from "../curriculum";
import type { Env } from "../../env";

/* ---- Response type helpers ---- */

interface ErrorResponse {
  error: string;
}

interface SavedResponse {
  saved: boolean;
}

interface ConversationResponse {
  messages: Array<{ role: string; content: string }>;
  updated_at: string | null;
}

interface ResetResponse {
  reset: boolean;
}

// Helper to extract typed JSON from Hono response
async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

/* ---- Validation unit tests ---- */

describe("isValidProfile", () => {
  it("accepts known profiles", () => {
    expect(isValidProfile("level-1")).toBe(true);
    expect(isValidProfile("veteran-engineer")).toBe(true);
    expect(isValidProfile("senior-tech-leader")).toBe(true);
  });

  it("rejects unknown profiles", () => {
    expect(isValidProfile("unknown")).toBe(false);
    expect(isValidProfile("")).toBe(false);
    expect(isValidProfile("NEW-GRAD")).toBe(false);
  });
});

describe("isValidSectionId", () => {
  it("accepts valid section IDs", () => {
    expect(isValidSectionId("1.1")).toBe(true);
    expect(isValidSectionId("2.3")).toBe(true);
    expect(isValidSectionId("10.12")).toBe(true);
  });

  it("rejects invalid section IDs", () => {
    expect(isValidSectionId("")).toBe(false);
    expect(isValidSectionId("abc")).toBe(false);
    expect(isValidSectionId("1")).toBe(false);
    expect(isValidSectionId("1.")).toBe(false);
    expect(isValidSectionId(".1")).toBe(false);
    expect(isValidSectionId("1.1.1")).toBe(false);
  });
});

/* ---- Mock D1 helpers ---- */

interface MockRow {
  messages_json: string;
  updated_at: string;
  archived_at: string | null;
}

function createMockDB() {
  const store = new Map<string, MockRow>();
  let idCounter = 0;

  const mockFirst = mock(async () => null as MockRow | null);
  const mockRun = mock(async () => ({ success: true }));
  const mockBind = mock();

  const mockPrepare = mock((sql: string) => {
    const statement = {
      bind: (...args: unknown[]) => {
        mockBind(...args);

        return {
          first: async <T = MockRow>() => {
            if (sql.includes("SELECT") && sql.includes("curriculum_conversations")) {
              // SELECT by (learner_id, profile, section_id) with archived_at IS NULL
              const key = `${args[0]}:${args[1]}:${args[2]}`;
              const row = store.get(key);
              if (row && row.archived_at !== null) return null;
              if (!row) return null;
              // Return with id for the UPDATE path
              return ({ ...row, id: key } as unknown as T) ?? null;
            }
            return null;
          },
          run: async () => {
            if (sql.includes("INSERT") && sql.includes("curriculum_conversations")) {
              // INSERT new conversation: bind is (learner_id, profile, section_id, messages_json)
              const key = `${args[0]}:${args[1]}:${args[2]}`;
              store.set(key, {
                messages_json: args[3] as string,
                updated_at: new Date().toISOString(),
                archived_at: null,
              });
            } else if (sql.includes("UPDATE") && sql.includes("messages_json") && sql.includes("WHERE id")) {
              // UPDATE by id: bind is (messages_json, id)
              const id = args[1] as string;
              const row = store.get(id);
              if (row) {
                row.messages_json = args[0] as string;
                row.updated_at = new Date().toISOString();
              }
            } else if (sql.includes("UPDATE") && sql.includes("archived_at")) {
              // Archive: bind is (learner_id, profile, section_id)
              const key = `${args[0]}:${args[1]}:${args[2]}`;
              const row = store.get(key);
              if (row && row.archived_at === null) {
                row.archived_at = new Date().toISOString();
              }
            }
            return { success: true };
          },
        };
      },
      first: mockFirst,
      run: mockRun,
    };
    return statement;
  });

  return { prepare: mockPrepare, _store: store };
}

/* ---- App setup with mock bindings ---- */

function createTestApp() {
  const mockDB = createMockDB();
  const app = new Hono<{ Bindings: Env }>();

  // Simulate session middleware: inject learnerId
  app.use("*", async (c, next) => {
    c.set("learnerId" as never, "test-learner-123");
    await next();
  });

  // Bind mock DB
  app.use("*", async (c, next) => {
    c.env = { ...c.env, DB: mockDB as unknown as D1Database };
    await next();
  });

  app.route("/curriculum", curriculum);

  return { app, mockDB };
}

/* ---- PUT /:profile/:sectionId/conversation ---- */

describe("PUT /curriculum/:profile/:sectionId/conversation", () => {
  let app: Hono<{ Bindings: Env }>;
  let mockDB: ReturnType<typeof createMockDB>;

  beforeEach(() => {
    const testApp = createTestApp();
    app = testApp.app;
    mockDB = testApp.mockDB;
  });

  it("returns 400 for invalid profile", async () => {
    const res = await app.request("/curriculum/unknown/1.1/conversation", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    });
    expect(res.status).toBe(400);
    const body = await json<ErrorResponse>(res);
    expect(body.error).toContain("Invalid profile");
  });

  it("returns 400 for invalid section_id", async () => {
    const res = await app.request("/curriculum/level-1/bad/conversation", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    });
    expect(res.status).toBe(400);
    const body = await json<ErrorResponse>(res);
    expect(body.error).toContain("Invalid section_id");
  });

  it("returns 400 for empty messages array", async () => {
    const res = await app.request("/curriculum/level-1/1.1/conversation", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [] }),
    });
    expect(res.status).toBe(400);
    const body = await json<ErrorResponse>(res);
    expect(body.error).toContain("non-empty array");
  });

  it("returns 400 for invalid JSON body", async () => {
    const res = await app.request("/curriculum/level-1/1.1/conversation", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
    const body = await json<ErrorResponse>(res);
    expect(body.error).toContain("Invalid JSON");
  });

  it("returns 200 with saved: true for valid request", async () => {
    const messages = [
      { role: "user", content: "What is a race condition?" },
      { role: "tutor", content: "What do you think happens when two threads access the same data?" },
    ];
    const res = await app.request("/curriculum/level-1/1.1/conversation", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    expect(res.status).toBe(200);
    const body = await json<SavedResponse>(res);
    expect(body.saved).toBe(true);
  });

  it("upserts: first PUT creates, second PUT updates", async () => {
    const firstMessages = [{ role: "user", content: "first" }];
    const secondMessages = [
      { role: "user", content: "first" },
      { role: "tutor", content: "response" },
      { role: "user", content: "follow-up" },
    ];

    // First PUT
    await app.request("/curriculum/level-1/1.1/conversation", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: firstMessages }),
    });

    // Second PUT (upsert)
    const res = await app.request("/curriculum/level-1/1.1/conversation", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: secondMessages }),
    });
    expect(res.status).toBe(200);

    // Verify via GET that the second PUT's messages are stored
    const getRes = await app.request("/curriculum/level-1/1.1/conversation");
    const body = await json<ConversationResponse>(getRes);
    expect(body.messages).toEqual(secondMessages);
  });
});

/* ---- GET /:profile/:sectionId/conversation ---- */

describe("GET /curriculum/:profile/:sectionId/conversation", () => {
  let app: Hono<{ Bindings: Env }>;

  beforeEach(() => {
    const testApp = createTestApp();
    app = testApp.app;
  });

  it("returns 400 for invalid profile", async () => {
    const res = await app.request("/curriculum/bogus/1.1/conversation");
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid section_id", async () => {
    const res = await app.request("/curriculum/level-1/xyz/conversation");
    expect(res.status).toBe(400);
  });

  it("returns empty messages for section with no conversation", async () => {
    const res = await app.request("/curriculum/level-1/1.1/conversation");
    expect(res.status).toBe(200);
    const body = await json<ConversationResponse>(res);
    expect(body.messages).toEqual([]);
    expect(body.updated_at).toBeNull();
  });

  it("returns messages that were PUT", async () => {
    const messages = [
      { role: "user", content: "hello" },
      { role: "tutor", content: "welcome" },
    ];

    await app.request("/curriculum/level-1/2.1/conversation", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    const res = await app.request("/curriculum/level-1/2.1/conversation");
    expect(res.status).toBe(200);
    const body = await json<ConversationResponse>(res);
    expect(body.messages).toEqual(messages);
    expect(body.updated_at).toBeTruthy();
  });
});

/* ---- DELETE /:profile/:sectionId/conversation ---- */

describe("DELETE /curriculum/:profile/:sectionId/conversation", () => {
  let app: Hono<{ Bindings: Env }>;

  beforeEach(() => {
    const testApp = createTestApp();
    app = testApp.app;
  });

  it("returns 400 for invalid profile", async () => {
    const res = await app.request("/curriculum/nope/1.1/conversation", {
      method: "DELETE",
    });
    expect(res.status).toBe(400);
  });

  it("returns 200 even when no conversation exists (idempotent)", async () => {
    const res = await app.request("/curriculum/level-1/1.1/conversation", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const body = await json<ResetResponse>(res);
    expect(body.reset).toBe(true);
  });

  it("removes conversation so subsequent GET returns empty", async () => {
    const messages = [{ role: "user", content: "to be deleted" }];

    // PUT a conversation
    await app.request("/curriculum/veteran-engineer/3.1/conversation", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    // DELETE it
    const delRes = await app.request(
      "/curriculum/veteran-engineer/3.1/conversation",
      { method: "DELETE" }
    );
    expect(delRes.status).toBe(200);
    const delBody = await json<ResetResponse>(delRes);
    expect(delBody.reset).toBe(true);

    // GET should return empty
    const getRes = await app.request(
      "/curriculum/veteran-engineer/3.1/conversation"
    );
    const getBody = await json<ConversationResponse>(getRes);
    expect(getBody.messages).toEqual([]);
    expect(getBody.updated_at).toBeNull();
  });
});
