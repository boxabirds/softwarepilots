import { describe, it, expect } from "vitest";
import app from "../../index";

const TEST_ENV = {
  ENVIRONMENT: "local",
  GITHUB_CLIENT_ID: "test-client-id",
  GITHUB_CLIENT_SECRET: "test-secret",
  JWT_SECRET: "test-jwt-secret-at-least-32-chars-long",
  WEB_APP_URL: "http://localhost:3000",
  GEMINI_API_KEY: "test-key",
};

/**
 * Tests for GET /api/auth/me
 *
 * The landing page calls /api/auth/me on load to check if the user
 * is authenticated. It must return 200 (not 401) to avoid browser
 * console errors on the network tab.
 */
describe("GET /api/auth/me", () => {
  it("returns 200 with null body when no session cookie is present", async () => {
    const res = await app.request("/api/auth/me", { method: "GET" }, TEST_ENV);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeNull();
  });

  it("returns 200 with null body when session cookie is invalid", async () => {
    const res = await app.request(
      "/api/auth/me",
      {
        method: "GET",
        headers: { Cookie: "sp_session=invalid-garbage-token" },
      },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeNull();
  });

  it("does not return 401 for unauthenticated requests", async () => {
    const res = await app.request("/api/auth/me", { method: "GET" }, TEST_ENV);
    expect(res.status).not.toBe(401);
  });
});
