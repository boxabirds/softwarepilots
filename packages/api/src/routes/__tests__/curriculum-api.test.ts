import { describe, it, expect } from "bun:test";
import { sign } from "hono/jwt";
import app from "../../index";

/* ---- Shared env and auth helper ---- */

const JWT_SECRET = "test-secret-at-least-32-chars-long";

const TEST_ENV = {
  ENVIRONMENT: "local",
  JWT_SECRET,
  GITHUB_CLIENT_ID: "test",
  GITHUB_CLIENT_SECRET: "test",
  WEB_APP_URL: "http://localhost:3000",
  GEMINI_API_KEY: "test",
};

async function authCookie(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const token = await sign({ sub: "test-learner", iat: now, exp: now + 3600 }, JWT_SECRET);
  return `sp_session=${token}`;
}

/* ---- Tests ---- */

describe("Curriculum API endpoints", () => {
  it("GET /api/curriculum returns array of 4 profiles", async () => {
    const cookie = await authCookie();
    const res = await app.request(
      "/api/curriculum",
      { headers: { Cookie: cookie } },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(4);
    expect(body.map((p: { profile: string }) => p.profile).sort()).toEqual([
      "level-0",
      "level-1",
      "level-10",
      "level-20",
    ]);
  });

  it("GET /api/curriculum/level-1 returns sections array", async () => {
    const cookie = await authCookie();
    const res = await app.request(
      "/api/curriculum/level-1",
      { headers: { Cookie: cookie } },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    // Each section should have expected fields
    const first = body[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("title");
    expect(first).toHaveProperty("module_id");
    expect(first).toHaveProperty("module_title");
  });

  it("GET /api/curriculum/level-1/1.1 returns section with markdown", async () => {
    const cookie = await authCookie();
    const res = await app.request(
      "/api/curriculum/level-1/1.1",
      { headers: { Cookie: cookie } },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body).toHaveProperty("id", "1.1");
    expect(body).toHaveProperty("title");
    expect(body).toHaveProperty("markdown");
    expect(typeof body.markdown).toBe("string");
    expect(body.markdown.length).toBeGreaterThan(0);
  });

  it("GET /api/curriculum/unknown returns 404", async () => {
    const cookie = await authCookie();
    const res = await app.request(
      "/api/curriculum/unknown",
      { headers: { Cookie: cookie } },
      TEST_ENV,
    );

    expect(res.status).toBe(404);
    const body: any = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("GET /api/curriculum/level-1/99.99 returns 404", async () => {
    const cookie = await authCookie();
    const res = await app.request(
      "/api/curriculum/level-1/99.99",
      { headers: { Cookie: cookie } },
      TEST_ENV,
    );

    expect(res.status).toBe(404);
    const body: any = await res.json();
    expect(body).toHaveProperty("error");
  });
});
