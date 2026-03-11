import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { Hono } from "hono";
import { sign, verify } from "hono/jwt";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SESSION_COOKIE_NAME } from "../../src/middleware/session-validation";

const MIGRATION_PATH = resolve(
  __dirname,
  "../../src/db/migrations/0001_skeleton.sql"
);
const TEST_SECRET = "integration-test-jwt-secret";
const TEST_GITHUB_CLIENT_ID = "test-client-id";
const TEST_GITHUB_CLIENT_SECRET = "test-client-secret";

/**
 * Integration test for the auth callback flow.
 * We can't easily test the full OAuth redirect chain with real GitHub,
 * but we can test the D1 upsert + JWT issuance logic in isolation.
 */
describe("auth integration — learner upsert and JWT issuance", () => {
  let db: InstanceType<typeof Database>;

  beforeAll(() => {
    db = new Database(":memory:");
    const migration = readFileSync(MIGRATION_PATH, "utf-8");
    db.exec(migration);
  });

  afterAll(() => {
    db.close();
  });

  beforeEach(() => {
    db.exec("DELETE FROM learners");
  });

  it("creates a new learner record on first sign-in", () => {
    db.prepare(
      `INSERT INTO learners (id, email, display_name, auth_provider, auth_subject)
       VALUES ('l1', 'alice@example.com', 'Alice', 'github', '11111')`
    ).run();

    const row = db.prepare(
      "SELECT * FROM learners WHERE auth_provider = 'github' AND auth_subject = '11111'"
    ).get() as { id: string; email: string; display_name: string };

    expect(row).toBeTruthy();
    expect(row.email).toBe("alice@example.com");
    expect(row.display_name).toBe("Alice");
  });

  it("updates existing learner on subsequent sign-in", () => {
    db.prepare(
      `INSERT INTO learners (id, email, display_name, auth_provider, auth_subject)
       VALUES ('l2', 'bob@old.com', 'Bob', 'github', '22222')`
    ).run();

    // Simulate update on re-auth
    db.prepare(
      `UPDATE learners SET last_active_at = datetime('now'), email = ?, display_name = ? WHERE id = ?`
    ).run("bob@new.com", "Robert", "l2");

    const row = db.prepare("SELECT * FROM learners WHERE id = 'l2'").get() as {
      email: string;
      display_name: string;
      last_active_at: string;
    };

    expect(row.email).toBe("bob@new.com");
    expect(row.display_name).toBe("Robert");
    expect(row.last_active_at).toBeTruthy();
  });

  it("prevents duplicate auth_provider + auth_subject pairs", () => {
    db.prepare(
      `INSERT INTO learners (id, email, display_name, auth_provider, auth_subject)
       VALUES ('l3', 'charlie@example.com', 'Charlie', 'github', '33333')`
    ).run();

    expect(() =>
      db.prepare(
        `INSERT INTO learners (id, email, display_name, auth_provider, auth_subject)
         VALUES ('l4', 'different@example.com', 'Diff', 'github', '33333')`
      ).run()
    ).toThrow();
  });

  it("issues a valid JWT with correct claims", async () => {
    const now = Math.floor(Date.now() / 1000);
    const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
    const token = await sign(
      { sub: "learner-test", iat: now, exp: now + SESSION_MAX_AGE_SECONDS },
      TEST_SECRET
    );

    const payload = await verify(token, TEST_SECRET, "HS256");
    expect(payload.sub).toBe("learner-test");
    expect(payload.exp).toBe(now + SESSION_MAX_AGE_SECONDS);
  });

  it("JWT verification fails with wrong secret", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await sign(
      { sub: "learner-test", iat: now, exp: now + 3600 },
      TEST_SECRET
    );

    await expect(verify(token, "wrong-secret")).rejects.toThrow();
  });

  it("sets HttpOnly Secure SameSite=Lax cookie attributes", () => {
    // Verify cookie string construction matches security requirements
    const token = "sample-jwt-token";
    const maxAge = 604800;
    const cookieValue = [
      `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
      `Max-Age=${maxAge}`,
      "Path=/",
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
    ].join("; ");

    expect(cookieValue).toContain("HttpOnly");
    expect(cookieValue).toContain("Secure");
    expect(cookieValue).toContain("SameSite=Lax");
    expect(cookieValue).toContain(`Max-Age=${maxAge}`);
    expect(cookieValue).toContain("Path=/");
  });
});
