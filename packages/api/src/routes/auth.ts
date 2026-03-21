import { Hono } from "hono";
import { sign } from "hono/jwt";
import type { Env } from "../env";
import { SESSION_COOKIE_NAME } from "../middleware/session-validation";


const DEFAULT_GITHUB_BASE = "https://github.com";
const DEFAULT_GITHUB_API_BASE = "https://api.github.com";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

function githubUrls(env: Env) {
  const base = env.GITHUB_BASE_URL || DEFAULT_GITHUB_BASE;
  const apiBase = env.GITHUB_API_BASE_URL || DEFAULT_GITHUB_API_BASE;
  return {
    authorize: `${base}/login/oauth/authorize`,
    token: `${base}/login/oauth/access_token`,
    user: `${apiBase}/user`,
    emails: `${apiBase}/user/emails`,
  };
}

const auth = new Hono<{ Bindings: Env }>();

auth.get("/login", (c) => {
  const gh = githubUrls(c.env);
  const params = new URLSearchParams({
    client_id: c.env.GITHUB_CLIENT_ID,
    redirect_uri: `${c.env.WEB_APP_URL}/api/auth/callback`,
    scope: "read:user user:email",
  });
  return c.redirect(`${gh.authorize}?${params}`);
});

auth.get("/callback", async (c) => {
  const code = c.req.query("code");
  const error = c.req.query("error");

  const webOrigin = c.env.WEB_APP_URL;

  if (error || !code) {
    const errorUrl = new URL("/", webOrigin);
    errorUrl.searchParams.set("auth_error", error || "missing_code");
    return c.redirect(errorUrl.toString());
  }

  // Exchange code for access token
  const gh = githubUrls(c.env);
  const tokenResponse = await fetch(gh.token, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: c.env.GITHUB_CLIENT_ID,
      client_secret: c.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  if (!tokenResponse.ok) {
    const errorUrl = new URL("/", webOrigin);
    errorUrl.searchParams.set("auth_error", "token_exchange_failed");
    return c.redirect(errorUrl.toString());
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
    error?: string;
  };

  if (!tokenData.access_token) {
    const errorUrl = new URL("/", webOrigin);
    errorUrl.searchParams.set(
      "auth_error",
      tokenData.error || "no_access_token"
    );
    return c.redirect(errorUrl.toString());
  }

  // Fetch user profile
  const userResponse = await fetch(gh.user, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/json",
      "User-Agent": "SoftwarePilots",
    },
  });

  if (!userResponse.ok) {
    const errorUrl = new URL("/", webOrigin);
    errorUrl.searchParams.set("auth_error", "profile_fetch_failed");
    return c.redirect(errorUrl.toString());
  }

  const profile = (await userResponse.json()) as {
    id: number;
    login: string;
    email: string | null;
    name: string | null;
  };

  // Fetch primary email if not public
  let email = profile.email;
  if (!email) {
    const emailResponse = await fetch(gh.emails, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/json",
        "User-Agent": "SoftwarePilots",
      },
    });
    if (emailResponse.ok) {
      const emails = (await emailResponse.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const primary = emails.find((e) => e.primary && e.verified);
      email = primary?.email || emails[0]?.email || null;
    }
  }

  if (!email) {
    const errorUrl = new URL("/", webOrigin);
    errorUrl.searchParams.set("auth_error", "no_email");
    return c.redirect(errorUrl.toString());
  }

  // Upsert learner in D1
  const authSubject = String(profile.id);
  const displayName = profile.name || profile.login;

  const existing = await c.env.DB.prepare(
    "SELECT id FROM learners WHERE auth_provider = ? AND auth_subject = ?"
  )
    .bind("github", authSubject)
    .first<{ id: string }>();

  let learnerId: string;

  if (existing) {
    learnerId = existing.id;
    await c.env.DB.prepare(
      "UPDATE learners SET last_active_at = datetime('now'), email = ?, display_name = ? WHERE id = ?"
    )
      .bind(email, displayName, learnerId)
      .run();
  } else {
    const insertResult = await c.env.DB.prepare(
      `INSERT INTO learners (email, display_name, auth_provider, auth_subject)
       VALUES (?, ?, 'github', ?)
       RETURNING id`
    )
      .bind(email, displayName, authSubject)
      .first<{ id: string }>();

    learnerId = insertResult!.id;
  }

  // Issue JWT session cookie
  const now = Math.floor(Date.now() / 1000);
  const token = await sign(
    { sub: learnerId, iat: now, exp: now + SESSION_MAX_AGE_SECONDS },
    c.env.JWT_SECRET
  );

  const isLocalDev = c.env.ENVIRONMENT === "local";
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (!isLocalDev) {
    cookieParts.push("Secure");
  }
  const cookieValue = cookieParts.join("; ");

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${webOrigin}/dashboard`,
      "Set-Cookie": cookieValue,
    },
  });
});

auth.post("/logout", (c) => {
  const isLocalDev = c.env.ENVIRONMENT === "local";
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=`,
    "Max-Age=0",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (!isLocalDev) {
    cookieParts.push("Secure");
  }
  const cookieValue = cookieParts.join("; ");

  return new Response(null, {
    status: 302,
    headers: {
      Location: c.env.WEB_APP_URL,
      "Set-Cookie": cookieValue,
    },
  });
});

export { auth };
