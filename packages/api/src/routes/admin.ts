import { Hono } from "hono";
import type { Env } from "../env";

const admin = new Hono<{ Bindings: Env }>();

/* GET /feedback - list all feedback joined with learner display_name */
admin.get("/feedback", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT
       cf.id,
       cf.profile,
       cf.section_id,
       cf.message_content,
       cf.message_index,
       cf.feedback_text,
       cf.created_at,
       l.display_name AS learner_name
     FROM curriculum_feedback cf
     JOIN learners l ON cf.learner_id = l.id
     ORDER BY cf.created_at DESC`
  ).all<{
    id: number;
    profile: string;
    section_id: string;
    message_content: string;
    message_index: number;
    feedback_text: string;
    created_at: string;
    learner_name: string;
  }>();

  return c.json(results ?? []);
});

/* DELETE /feedback/:id - delete single feedback entry */
admin.delete("/feedback/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare(
    "SELECT id FROM curriculum_feedback WHERE id = ?"
  )
    .bind(id)
    .first();

  if (!existing) {
    return c.json({ error: "Feedback entry not found" }, 404);
  }

  await c.env.DB.prepare("DELETE FROM curriculum_feedback WHERE id = ?")
    .bind(id)
    .run();

  return c.json({ deleted: true });
});

export { admin };
