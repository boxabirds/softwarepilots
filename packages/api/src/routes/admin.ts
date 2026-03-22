import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import type { Env } from "../env";
import { getProgressForProfile, computeClaimProgress } from "./curriculum-progress";
import { getCurriculumSections, getCurriculumProfiles } from "@softwarepilots/shared";

const admin = new Hono<{ Bindings: Env }>();

/* All admin routes require ADMIN_API_KEY */
admin.use("*", async (c, next) => {
  const middleware = bearerAuth({ token: c.env.ADMIN_API_KEY });
  return middleware(c, next);
});

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

/* ---------- User management endpoints ---------- */

/* GET /users - list all learners with per-profile progress summaries */
admin.get("/users", async (c) => {
  const { results: learners } = await c.env.DB.prepare(
    "SELECT id, display_name, enrolled_at, last_active_at FROM learners ORDER BY last_active_at DESC"
  ).all<{
    id: string;
    display_name: string | null;
    enrolled_at: string | null;
    last_active_at: string | null;
  }>();

  const users = [];
  for (const learner of learners ?? []) {
    // Find profiles where the learner has at least one non-not_started row
    const { results: activeProfiles } = await c.env.DB.prepare(
      `SELECT DISTINCT profile FROM curriculum_progress
       WHERE learner_id = ? AND status != 'not_started'`
    )
      .bind(learner.id)
      .all<{ profile: string }>();

    const profiles = [];
    for (const { profile } of activeProfiles ?? []) {
      let sections: ReturnType<typeof getCurriculumSections>;
      try {
        sections = getCurriculumSections(profile);
      } catch {
        // Unknown profile - skip
        continue;
      }
      const totalSections = sections.length;

      const { results: progressRows } = await c.env.DB.prepare(
        `SELECT section_id, status, claims_json FROM curriculum_progress
         WHERE learner_id = ? AND profile = ?`
      )
        .bind(learner.id, profile)
        .all<{ section_id: string; status: string; claims_json: string | null }>();

      let sectionsStarted = 0;
      let sectionsCompleted = 0;
      let totalDemonstrated = 0;
      let totalClaims = 0;

      for (const row of progressRows ?? []) {
        if (row.status === "in_progress" || row.status === "paused" || row.status === "needs_review") {
          sectionsStarted++;
        } else if (row.status === "completed") {
          sectionsCompleted++;
        }

        // Aggregate claim progress per section
        const sectionDef = sections.find((s) => s.id === row.section_id);
        if (sectionDef) {
          const learningMap = sectionDef.learning_map;
          if (learningMap && learningMap.core_claims.length > 0) {
            const progress = computeClaimProgress(row.claims_json, learningMap);
            totalDemonstrated += progress.demonstrated;
            totalClaims += progress.total;
          }
        }
      }

      const claimPercentage = totalClaims > 0
        ? Math.round((totalDemonstrated / totalClaims) * 100)
        : 0;

      profiles.push({
        profile,
        sections_started: sectionsStarted,
        sections_completed: sectionsCompleted,
        total_sections: totalSections,
        claim_percentage: claimPercentage,
      });
    }

    users.push({
      id: learner.id,
      display_name: learner.display_name,
      enrolled_at: learner.enrolled_at,
      last_active_at: learner.last_active_at,
      profiles,
    });
  }

  return c.json(users);
});

/* GET /users/:learnerId/progress - full progress for one learner across all started profiles */
admin.get("/users/:learnerId/progress", async (c) => {
  const learnerId = c.req.param("learnerId");

  const learner = await c.env.DB.prepare(
    "SELECT id, display_name, enrolled_at FROM learners WHERE id = ?"
  )
    .bind(learnerId)
    .first<{ id: string; display_name: string | null; enrolled_at: string | null }>();

  if (!learner) {
    return c.json({ error: "Learner not found" }, 404);
  }

  const profileSummaries = getCurriculumProfiles();
  const profiles = [];

  for (const ps of profileSummaries) {
    const sections = await getProgressForProfile(c.env.DB, learnerId, ps.profile);
    if (sections.length > 0) {
      profiles.push({
        profile: ps.profile,
        title: ps.title,
        sections,
      });
    }
  }

  return c.json({
    learner: {
      id: learner.id,
      display_name: learner.display_name,
      enrolled_at: learner.enrolled_at,
    },
    profiles,
  });
});

/* GET /users/:learnerId/section-events/:profile/:sectionId - raw progress data for event log */
admin.get("/users/:learnerId/section-events/:profile/:sectionId", async (c) => {
  const learnerId = c.req.param("learnerId");
  const profile = c.req.param("profile");
  const sectionId = c.req.param("sectionId");

  const learner = await c.env.DB.prepare(
    "SELECT id FROM learners WHERE id = ?"
  )
    .bind(learnerId)
    .first<{ id: string }>();

  if (!learner) {
    return c.json({ error: "Learner not found" }, 404);
  }

  const row = await c.env.DB.prepare(
    `SELECT status, understanding_json, claims_json, concepts_json,
            started_at, completed_at, paused_at, updated_at
     FROM curriculum_progress
     WHERE learner_id = ? AND profile = ? AND section_id = ?`
  )
    .bind(learnerId, profile, sectionId)
    .first<{
      status: string;
      understanding_json: string;
      claims_json: string | null;
      concepts_json: string | null;
      started_at: string | null;
      completed_at: string | null;
      paused_at: string | null;
      updated_at: string;
    }>();

  if (!row) {
    return c.json({
      status: "not_started",
      understanding_json: "[]",
      claims_json: "{}",
      concepts_json: "{}",
      started_at: null,
      completed_at: null,
      paused_at: null,
      updated_at: null,
    });
  }

  return c.json({
    status: row.status,
    understanding_json: row.understanding_json || "[]",
    claims_json: row.claims_json || "{}",
    concepts_json: row.concepts_json || "{}",
    started_at: row.started_at,
    completed_at: row.completed_at,
    paused_at: row.paused_at,
    updated_at: row.updated_at,
  });
});

/* GET /users/:learnerId/conversations/:profile/:sectionId - conversation history */
admin.get("/users/:learnerId/conversations/:profile/:sectionId", async (c) => {
  const learnerId = c.req.param("learnerId");
  const profile = c.req.param("profile");
  const sectionId = c.req.param("sectionId");

  const learner = await c.env.DB.prepare(
    "SELECT id FROM learners WHERE id = ?"
  )
    .bind(learnerId)
    .first<{ id: string }>();

  if (!learner) {
    return c.json({ error: "Learner not found" }, 404);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT id, messages_json, summary, archived_at, created_at
     FROM curriculum_conversations
     WHERE learner_id = ? AND profile = ? AND section_id = ?
     ORDER BY created_at DESC`
  )
    .bind(learnerId, profile, sectionId)
    .all<{
      id: string;
      messages_json: string;
      summary: string | null;
      archived_at: string | null;
      created_at: string;
    }>();

  const conversations = (results ?? []).map((row) => {
    let messages: unknown[];
    try {
      messages = JSON.parse(row.messages_json);
    } catch {
      messages = [];
    }
    return {
      id: row.id,
      messages,
      summary: row.summary ?? null,
      archived_at: row.archived_at ?? null,
      created_at: row.created_at,
    };
  });

  return c.json({ conversations });
});

export { admin };
