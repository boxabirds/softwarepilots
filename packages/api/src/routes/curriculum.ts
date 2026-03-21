import { Hono } from "hono";
import type { Env } from "../env";
import {
  getCurriculumProfiles,
  getCurriculumSections,
  getSection,
} from "@softwarepilots/shared";

export const curriculum = new Hono<{ Bindings: Env }>();

curriculum.get("/", (c) => {
  return c.json(getCurriculumProfiles());
});

curriculum.get("/:profile", (c) => {
  const profile = c.req.param("profile");
  try {
    return c.json(getCurriculumSections(profile));
  } catch {
    return c.json({ error: `Unknown profile: ${profile}` }, 404);
  }
});

curriculum.get("/:profile/:sectionId", (c) => {
  const profile = c.req.param("profile");
  const sectionId = c.req.param("sectionId");
  try {
    return c.json(getSection(profile, sectionId));
  } catch {
    return c.json(
      { error: `Section "${sectionId}" not found for profile "${profile}"` },
      404,
    );
  }
});
