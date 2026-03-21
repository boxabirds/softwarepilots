import { Hono } from "hono";
import type { Env } from "./env";
import { auth } from "./routes/auth";
import { submissions } from "./routes/submissions";
import { chat } from "./routes/chat";
import { curriculum } from "./routes/curriculum";
import { socraticChat } from "./routes/socratic-chat";
import { admin } from "./routes/admin";
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

app.route("/api/submissions", submissions);
app.route("/api/chat", chat);
app.route("/api/curriculum", curriculum);
app.route("/api/socratic", socraticChat);
app.route("/api/admin", admin);

export default app;
