import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";
import type { Env } from "../env";

const SESSION_COOKIE_NAME = "sp_session";

export interface SessionPayload {
  sub: string; // learner_id
  exp: number;
}

export const sessionValidation = createMiddleware<{ Bindings: Env }>(
  async (c, next) => {
    // Auth routes handle their own authentication
    if (c.req.path.startsWith("/api/auth/")) {
      await next();
      return;
    }

    const cookie = getCookie(c.req.raw, SESSION_COOKIE_NAME);
    if (!cookie) {
      return c.json({ error: "Authentication required" }, 401);
    }

    try {
      const payload = (await verify(cookie, c.env.JWT_SECRET, "HS256")) as SessionPayload;
      c.set("learnerId" as never, payload.sub);
      await next();
    } catch {
      return c.json({ error: "Invalid or expired session" }, 401);
    }
  }
);

function getCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("Cookie");
  if (!header) return undefined;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export { SESSION_COOKIE_NAME };
