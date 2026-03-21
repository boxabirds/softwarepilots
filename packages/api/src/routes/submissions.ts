import { Hono } from "hono";
import type { Env } from "../env";
import { getAllExerciseIds } from "@softwarepilots/shared";

const MIN_SCORE = 1;
const MAX_SCORE = 10;

const KNOWN_EXERCISES = new Set(getAllExerciseIds());

interface SubmissionPayload {
  module_id: string;
  exercise_id: string;
  content: {
    code: string;
    console_output: string;
    prediction?: string;
    modifications: string[];
  };
  self_assessment?: {
    predictions: Record<string, number>;
    weakest_dimension: string;
  };
}

const submissions = new Hono<{ Bindings: Env }>();

submissions.post("/", async (c) => {
  const learnerId = c.get("learnerId" as never) as string;

  let body: SubmissionPayload;
  try {
    body = await c.req.json<SubmissionPayload>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  // Validate required fields
  const validationError = validateSubmission(body);
  if (validationError) {
    return c.json({ error: validationError }, 400);
  }

  // Insert submission
  const result = await c.env.DB.prepare(
    `INSERT INTO submissions (learner_id, module_id, exercise_id, content_json, self_assessment_json, rubric_version)
     VALUES (?, ?, ?, ?, ?, ?)
     RETURNING id`
  )
    .bind(
      learnerId,
      body.module_id,
      body.exercise_id,
      JSON.stringify(body.content),
      body.self_assessment ? JSON.stringify(body.self_assessment) : null,
      "v1"
    )
    .first<{ id: string }>();

  const submissionId = result!.id;

  // Upsert progress
  await c.env.DB.prepare(
    `INSERT INTO progress (learner_id, module_id, exercise_id, status, attempts, first_submitted, last_submitted)
     VALUES (?, ?, ?, 'submitted', 1, datetime('now'), datetime('now'))
     ON CONFLICT (learner_id, module_id, exercise_id)
     DO UPDATE SET status = 'submitted', attempts = attempts + 1, last_submitted = datetime('now')`
  )
    .bind(learnerId, body.module_id, body.exercise_id)
    .run();

  // Invoke evaluator - service binding in production, HTTP fallback for local dev
  try {
    const evaluateRequest = new Request(
      c.env.EVALUATOR_URL
        ? `${c.env.EVALUATOR_URL}/evaluate`
        : "https://evaluator/evaluate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: submissionId }),
      }
    );

    const fetcher = c.env.EVALUATOR_URL ? globalThis : c.env.EVALUATOR;
    c.executionCtx.waitUntil(fetcher.fetch(evaluateRequest));
  } catch {
    // Evaluator invocation failure is non-blocking; submission is preserved
  }

  return c.json({ id: submissionId, status: "submitted" }, 202);
});

submissions.get("/:id", async (c) => {
  const learnerId = c.get("learnerId" as never) as string;
  const submissionId = c.req.param("id");

  const row = await c.env.DB.prepare(
    `SELECT id, module_id, exercise_id, content_json, self_assessment_json,
            score_json, evaluator_model, calibration_gap_json, submitted_at, scored_at
     FROM submissions WHERE id = ? AND learner_id = ?`
  )
    .bind(submissionId, learnerId)
    .first();

  if (!row) {
    return c.json({ error: "Submission not found" }, 404);
  }

  return c.json(row);
});

function validateSubmission(body: SubmissionPayload): string | null {
  if (!body.module_id || !body.exercise_id) {
    return "module_id and exercise_id are required";
  }

  if (!KNOWN_EXERCISES.has(body.exercise_id)) {
    return `Unknown exercise: ${body.exercise_id}`;
  }

  if (!body.content || !body.content.code) {
    return "content.code is required";
  }

  if (body.self_assessment) {
    if (!body.self_assessment.predictions) {
      return "self_assessment.predictions is required when self_assessment is provided";
    }

    if (!body.self_assessment.weakest_dimension) {
      return "self_assessment.weakest_dimension is required when self_assessment is provided";
    }

    for (const [key, value] of Object.entries(body.self_assessment.predictions)) {
      if (typeof value !== "number" || value < MIN_SCORE || value > MAX_SCORE) {
        return `self_assessment.predictions.${key} must be a number between ${MIN_SCORE} and ${MAX_SCORE}`;
      }
    }
  }

  return null;
}

export { submissions, validateSubmission };
