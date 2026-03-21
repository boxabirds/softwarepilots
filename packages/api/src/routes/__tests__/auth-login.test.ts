import { describe, it, expect } from "vitest";
import app from "../../index";

const LOCAL_ENV = {
  ENVIRONMENT: "local",
  GITHUB_CLIENT_ID: "test-client-id",
  GITHUB_CLIENT_SECRET: "test-secret",
  JWT_SECRET: "test-jwt-secret-at-least-32-chars-long",
  WEB_APP_URL: "http://localhost:3000",
  GEMINI_API_KEY: "test-key",
};

const PROD_ENV = {
  ...LOCAL_ENV,
  ENVIRONMENT: "production",
};

/**
 * Tests for the auth login redirect.
 *
 * When ENVIRONMENT=local, OAuth should redirect to the fake GitHub
 * server at localhost:9999 instead of github.com.
 */
describe("GET /api/auth/login", () => {
  it("redirects to fake GitHub (localhost:9999) when ENVIRONMENT=local", async () => {
    const res = await app.request("/api/auth/login", { method: "GET" }, LOCAL_ENV);

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("localhost:9999");
    expect(location).toContain("client_id=test-client-id");
    expect(location).not.toContain("github.com");
  });

  it("redirects to real GitHub when ENVIRONMENT=production", async () => {
    const res = await app.request("/api/auth/login", { method: "GET" }, PROD_ENV);

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("github.com");
    expect(location).not.toContain("localhost:9999");
  });
});
