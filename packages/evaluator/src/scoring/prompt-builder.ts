interface RubricDimension {
  key: string;
  weight: number;
  description: string;
}

interface Rubric {
  id: string;
  title: string;
  starter_code: string;
  dimensions: RubricDimension[];
  pass_threshold: number;
  step_summary: string;
  scoring_guidance: Record<string, string>;
}

interface SubmissionContent {
  code: string;
  console_output: string;
  modifications: string[];
  prediction?: string;
}

export function buildEvaluationPrompt(
  rubric: Rubric,
  content: SubmissionContent
): { system: string; user: string } {
  const dimensionList = rubric.dimensions
    .map(
      (d) =>
        `- "${d.key}" (weight ${d.weight}): ${d.description}`
    )
    .join("\n");

  const guidanceBlocks = Object.entries(rubric.scoring_guidance)
    .map(([key, guidance]) => `IMPORTANT for ${key}: ${guidance}`)
    .join("\n\n");

  const system = `You are an educational evaluator for the Software Pilotry Foundation Course.
You are scoring exercise "${rubric.title}" (${rubric.id}).

CONTEXT: ${rubric.step_summary}

The learner's descriptions under "Modifications" explain what THEY CHANGED and why — not the original code. Evaluate them in that context.

${guidanceBlocks}

Score the learner's submission on each dimension using a 1-10 scale.
Provide specific, constructive feedback for each dimension. Keep feedback concise (1-2 sentences).

Dimensions to evaluate:
${dimensionList}

You MUST respond with valid JSON matching this exact schema:
{
  "scores": [
    { "key": "<dimension_key>", "score": <1-10>, "feedback": "<specific feedback>" }
  ]
}

Do not include any text outside the JSON object.`;

  const modificationsText =
    content.modifications.length > 0
      ? content.modifications.join("\n")
      : "(learner did not describe any modifications)";

  const predictionSection = content.prediction?.trim()
    ? `## Learner's Prediction (written BEFORE running the code)
${content.prediction.trim()}

`
    : `## Learner's Prediction
(learner did not write a prediction)

`;

  const user = `## Starter Code (provided to the learner)
\`\`\`python
${rubric.starter_code}
\`\`\`

## Learner's Final Code
\`\`\`python
${content.code}
\`\`\`

${predictionSection}## Console Output (from their final run)
\`\`\`
${content.console_output}
\`\`\`

## Learner's Description of Their Modifications
${modificationsText}`;

  return { system, user };
}
