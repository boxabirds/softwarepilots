export interface Env {
  DB: D1Database;
  EVALUATOR: Fetcher;
  ENVIRONMENT: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  JWT_SECRET: string;
  WEB_APP_URL: string; // Frontend origin for redirects (e.g. http://localhost:3000)
  EVALUATOR_URL?: string; // Local dev: direct HTTP fallback (e.g. http://localhost:8788)
  GEMINI_API_KEY: string;
  GEMINI_MODEL?: string;
  // Override for local dev with fake GitHub server (e.g. http://localhost:9999)
  GITHUB_BASE_URL?: string;
  GITHUB_API_BASE_URL?: string;
}
