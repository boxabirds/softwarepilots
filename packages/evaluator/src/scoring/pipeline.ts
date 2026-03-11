import type { Env } from "../env";
import { buildEvaluationPrompt } from "./prompt-builder";
import { parseEvaluatorResponse } from "./response-parser";
import { buildScoringResult, type ScoringResult } from "./gap-calculator";
import rubric21 from "../rubrics/2.1.json";

const RETRY_DELAY_MS = 1000;
const MAX_RETRIES = 1;
const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

interface SubmissionRow {
  id: string;
  content_json: string;
  self_assessment_json: string | null;
  module_id: string;
  exercise_id: string;
}

export async function evaluateSubmission(
  submissionId: string,
  env: Env
): Promise<ScoringResult> {
  // 1. Fetch submission
  const submission = await env.DB.prepare(
    "SELECT id, content_json, self_assessment_json, module_id, exercise_id FROM submissions WHERE id = ?"
  )
    .bind(submissionId)
    .first<SubmissionRow>();

  if (!submission) {
    throw new Error(`Submission ${submissionId} not found`);
  }

  // 2. Load rubric
  const rubric = loadRubric(submission.exercise_id);
  const content = JSON.parse(submission.content_json);
  const selfAssessment = submission.self_assessment_json
    ? JSON.parse(submission.self_assessment_json)
    : { predictions: {} };

  // 3. Build prompt and call Gemini
  const model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const { system, user } = buildEvaluationPrompt(rubric, content);
  const modelResponse = await callGeminiWithRetry(env, model, system, user);

  // 4. Parse response
  const dimensions = parseEvaluatorResponse(modelResponse, rubric.dimensions);

  // 5. Compute scores and calibration gaps
  const result = buildScoringResult(
    dimensions,
    selfAssessment.predictions,
    rubric.pass_threshold
  );

  // 6. Persist results
  await env.DB.prepare(
    `UPDATE submissions
     SET score_json = ?, calibration_gap_json = ?, evaluator_model = ?, scored_at = datetime('now')
     WHERE id = ?`
  )
    .bind(
      JSON.stringify(result.dimension_scores),
      JSON.stringify(result.calibration_gaps),
      model,
      submissionId
    )
    .run();

  // 7. Update progress
  await env.DB.prepare(
    `UPDATE progress SET status = 'scored', score_json = ?
     WHERE learner_id = (SELECT learner_id FROM submissions WHERE id = ?)
       AND module_id = ? AND exercise_id = ?`
  )
    .bind(
      JSON.stringify({
        overall: result.overall_score,
        passed: result.passed,
      }),
      submissionId,
      submission.module_id,
      submission.exercise_id
    )
    .run();

  return result;
}

function loadRubric(exerciseId: string) {
  if (exerciseId === "2.1") {
    return rubric21;
  }
  throw new Error(`No rubric found for exercise ${exerciseId}`);
}

async function callGeminiWithRetry(
  env: Env,
  model: string,
  system: string,
  user: string
): Promise<string> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `${GEMINI_API_URL}/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini API ${response.status}: ${errorBody}`);
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (!text) {
        throw new Error("Empty response from Gemini");
      }

      return text;
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      throw err;
    }
  }

  throw new Error("Unreachable");
}
