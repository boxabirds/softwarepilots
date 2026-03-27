import type { Env } from "../env";
import { buildEvaluationPrompt } from "./prompt-builder";
import { parseEvaluatorResponse } from "./response-parser";
import { buildScoringResult, type ScoringResult } from "./gap-calculator";
import { getExerciseRubric } from "@softwarepilots/shared";

const RETRY_DELAY_MS = 1000;
const MAX_RETRIES = 1;
const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/* ---- Inline prompt helpers (evaluator is a separate Worker, no shared lib) ---- */

const TEMPLATE_PATTERN = /\{\{(\w+(?:\.\w+)*)\}\}/g;

async function getPromptContent(db: D1Database, key: string): Promise<string> {
  const result = await db
    .prepare(
      `SELECT content FROM prompts WHERE key = ? AND deleted = 0 ORDER BY version DESC LIMIT 1`
    )
    .bind(key)
    .first<{ content: string }>();
  if (!result) {
    throw new Error(`Prompt not found: "${key}". Run the seed script to populate prompts.`);
  }
  return result.content;
}

function resolveTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(TEMPLATE_PATTERN, (match, varName: string) => {
    if (varName in vars) return vars[varName];
    console.warn(`[prompts] Unresolved template variable: ${match}`);
    return match;
  });
}

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
  const rubric = getExerciseRubric(submission.exercise_id);
  const content = JSON.parse(submission.content_json);
  const selfAssessment = submission.self_assessment_json
    ? JSON.parse(submission.self_assessment_json)
    : null;

  // 3. Fetch prompt template from DB and resolve variables
  const model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const dimensionList = rubric.dimensions
    .map((d) => `- "${d.key}" (weight ${d.weight}): ${d.description}`)
    .join("\n");
  const guidanceBlocks = Object.entries(rubric.scoring_guidance)
    .map(([key, guidance]) => `IMPORTANT for ${key}: ${guidance}`)
    .join("\n\n");
  const systemTemplate = await getPromptContent(env.DB, "evaluator.system");
  const resolvedSystem = resolveTemplate(systemTemplate, {
    rubric_title: rubric.title,
    rubric_id: rubric.id,
    step_summary: rubric.step_summary,
    guidance_blocks: guidanceBlocks,
    dimension_list: dimensionList,
  });
  const { system, user } = buildEvaluationPrompt(rubric, content, resolvedSystem);
  const modelResponse = await callGeminiWithRetry(env, model, system, user);

  // 4. Parse response
  const dimensions = parseEvaluatorResponse(modelResponse, rubric.dimensions);

  // 5. Compute scores and calibration gaps
  const predictions = selfAssessment?.predictions ?? {};
  const result = buildScoringResult(
    dimensions,
    predictions,
    rubric.pass_threshold
  );

  // 6. Persist results (omit calibration gaps if no self-assessment)
  const calibrationJson = selfAssessment
    ? JSON.stringify(result.calibration_gaps)
    : null;

  await env.DB.prepare(
    `UPDATE submissions
     SET score_json = ?, calibration_gap_json = ?, evaluator_model = ?, scored_at = datetime('now')
     WHERE id = ?`
  )
    .bind(
      JSON.stringify(result.dimension_scores),
      calibrationJson,
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
