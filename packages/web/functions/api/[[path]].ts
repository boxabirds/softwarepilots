/**
 * Cloudflare Pages Function that proxies /api/* requests to the API worker.
 * Uses service binding when available (same-zone), falls back to fetch for dev.
 */

interface FnEnv {
  API_WORKER: Fetcher;
  API_WORKER_URL?: string;
}

export const onRequest: PagesFunction<FnEnv> = async (context) => {
  const url = new URL(context.request.url);
  const path = url.pathname + url.search;

  // Service binding (preferred in production/staging)
  if (context.env.API_WORKER) {
    return context.env.API_WORKER.fetch(
      new Request(`https://api-worker${path}`, context.request)
    );
  }

  // Fallback: direct URL fetch
  if (context.env.API_WORKER_URL) {
    return fetch(
      new Request(`${context.env.API_WORKER_URL}${path}`, context.request)
    );
  }

  return new Response("API proxy not configured", { status: 502 });
};
