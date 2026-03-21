import { Hono } from "hono";
import type { Env } from "../env";
import { getProgressForProfile } from "./curriculum-progress";

export const curriculum = new Hono<{ Bindings: Env }>();

/**
 * GET /:profile/progress
 *
 * Returns the learner's progress for all sections within a curriculum profile.
 * Must be defined BEFORE /:profile/:sectionId to avoid "progress" being
 * captured as a sectionId.
 */
curriculum.get("/:profile/progress", async (c) => {
  const learnerId = c.get("learnerId" as never) as string;
  const profile = c.req.param("profile");

  if (!learnerId) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const progress = await getProgressForProfile(c.env.DB, learnerId, profile);
  return c.json(progress);
});

/**
 * GET /:profile/:sectionId
 *
 * Placeholder for fetching section content — defined after /progress
 * to avoid route collision.
 */
curriculum.get("/:profile/:sectionId", async (c) => {
  const profile = c.req.param("profile");
  const sectionId = c.req.param("sectionId");
  return c.json({ profile, sectionId, message: "Section content endpoint" });
});
