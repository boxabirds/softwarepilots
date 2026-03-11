import { Hono } from "hono";
import type { Env } from "./env";
import { evaluateSubmission } from "./scoring/pipeline";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "softwarepilots-evaluator",
    environment: c.env.ENVIRONMENT,
  });
});

app.post("/evaluate", async (c) => {
  const body = await c.req.json<{ submission_id: string }>();

  if (!body.submission_id) {
    return c.json({ error: "submission_id required" }, 400);
  }

  try {
    const result = await evaluateSubmission(body.submission_id, c.env);
    return c.json({ status: "scored", result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    // Mark submission as evaluation_pending for manual retry
    try {
      await c.env.DB.prepare(
        "UPDATE submissions SET evaluator_model = ? WHERE id = ? AND score_json IS NULL"
      )
        .bind(`error: ${message}`, body.submission_id)
        .run();
    } catch {
      // Best effort
    }

    return c.json({ status: "evaluation_pending", error: message }, 500);
  }
});

export default app;
