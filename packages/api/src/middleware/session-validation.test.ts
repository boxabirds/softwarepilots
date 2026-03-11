import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { sessionValidation, SESSION_COOKIE_NAME } from "./session-validation";

const TEST_SECRET = "test-jwt-secret-for-unit-tests";
const PROTECTED_URL = "http://localhost/protected";

function createApp() {
  const app = new Hono<{
    Bindings: { JWT_SECRET: string };
  }>();

  app.use("/*", sessionValidation as never);
  app.get("/protected", (c) => {
    const learnerId = c.get("learnerId" as never);
    return c.json({ learnerId });
  });

  return app;
}

const ENV = { JWT_SECRET: TEST_SECRET };

describe("session validation middleware", () => {
  const app = createApp();

  it("returns 401 when no cookie is present", async () => {
    const res = await app.request(PROTECTED_URL, {}, ENV);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error", "Authentication required");
  });

  it("returns 401 for an invalid JWT", async () => {
    const cookie = `${SESSION_COOKIE_NAME}=garbage-token`;
    const res = await app.request(
      PROTECTED_URL,
      { headers: { Cookie: cookie } },
      ENV
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error", "Invalid or expired session");
  });

  it("returns 401 for an expired JWT", async () => {
    const pastTime = Math.floor(Date.now() / 1000) - 3600;
    const token = await sign(
      { sub: "learner-1", iat: pastTime - 3600, exp: pastTime },
      TEST_SECRET
    );
    const cookie = `${SESSION_COOKIE_NAME}=${token}`;
    const res = await app.request(
      PROTECTED_URL,
      { headers: { Cookie: cookie } },
      ENV
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 for a JWT signed with a different secret", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await sign(
      { sub: "learner-1", iat: now, exp: now + 3600 },
      "wrong-secret"
    );
    const cookie = `${SESSION_COOKIE_NAME}=${token}`;
    const res = await app.request(
      PROTECTED_URL,
      { headers: { Cookie: cookie } },
      ENV
    );
    expect(res.status).toBe(401);
  });

  it("passes through and sets learnerId for a valid JWT", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await sign(
      { sub: "learner-abc", iat: now, exp: now + 3600 },
      TEST_SECRET
    );
    const cookie = `${SESSION_COOKIE_NAME}=${token}`;
    const res = await app.request(
      PROTECTED_URL,
      { headers: { Cookie: cookie } },
      ENV
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("learnerId", "learner-abc");
  });

  it("handles URL-encoded cookie values", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await sign(
      { sub: "learner-xyz", iat: now, exp: now + 3600 },
      TEST_SECRET
    );
    const encoded = encodeURIComponent(token);
    const cookie = `${SESSION_COOKIE_NAME}=${encoded}`;
    const res = await app.request(
      PROTECTED_URL,
      { headers: { Cookie: cookie } },
      ENV
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("learnerId", "learner-xyz");
  });

  it("ignores other cookies and finds the session cookie", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await sign(
      { sub: "learner-multi", iat: now, exp: now + 3600 },
      TEST_SECRET
    );
    const cookie = `other=value; ${SESSION_COOKIE_NAME}=${token}; another=thing`;
    const res = await app.request(
      PROTECTED_URL,
      { headers: { Cookie: cookie } },
      ENV
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("learnerId", "learner-multi");
  });
});
