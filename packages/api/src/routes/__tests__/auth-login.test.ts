import { describe, it, expect } from "vitest";
import app from "../../index";

const DEFAULT_ENV = {
  ENVIRONMENT: "local",
  GITHUB_CLIENT_ID: "test-client-id",
  GITHUB_CLIENT_SECRET: "test-secret",
  JWT_SECRET: "test-jwt-secret-at-least-32-chars-long",
  WEB_APP_URL: "http://localhost:3000",
  GEMINI_API_KEY: "test-key",
};

const FAKE_GITHUB_ENV = {
  ...DEFAULT_ENV,
  GITHUB_BASE_URL: "http://localhost:9999",
  GITHUB_API_BASE_URL: "http://localhost:9999",
};

/**
 * Tests for the auth login redirect.
 *
 * GITHUB_BASE_URL env var overrides the GitHub OAuth URL.
 * Used by e2e tests with the fake GitHub server.
 * Local dev uses real GitHub (existing GitHub OAuth app).
 */
describe("GET /api/auth/login", () => {
  it("redirects to real GitHub by default", async () => {
    const res = await app.request("/api/auth/login", { method: "GET" }, DEFAULT_ENV);

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("github.com");
    expect(location).toContain("client_id=test-client-id");
  });

  it("redirects to fake GitHub when GITHUB_BASE_URL is set", async () => {
    const res = await app.request("/api/auth/login", { method: "GET" }, FAKE_GITHUB_ENV);

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("localhost:9999");
    expect(location).not.toContain("github.com");
  });
});
