import { Hono } from "hono";
import type { Env } from "./env";
import { auth } from "./routes/auth";
import { submissions } from "./routes/submissions";
import { chat } from "./routes/chat";
import { sessionValidation } from "./middleware/session-validation";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "softwarepilots-api",
    environment: c.env.ENVIRONMENT,
  });
});

// Public auth routes (login, callback, logout)
app.route("/api/auth", auth);

// All other /api/* routes require authentication
app.use("/api/*", sessionValidation);

app.get("/api/auth/me", async (c) => {
  const learnerId = c.get("learnerId" as never) as string;
  const learner = await c.env.DB.prepare(
    "SELECT id, email, display_name, enrolled_at FROM learners WHERE id = ?"
  )
    .bind(learnerId)
    .first();

  if (!learner) {
    return c.json({ error: "Learner not found" }, 404);
  }
  return c.json(learner);
});

app.route("/api/submissions", submissions);
app.route("/api/chat", chat);

export default app;
