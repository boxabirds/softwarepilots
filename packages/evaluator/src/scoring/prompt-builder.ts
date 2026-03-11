interface RubricDimension {
  key: string;
  weight: number;
  description: string;
}

interface Rubric {
  exercise_id: string;
  title: string;
  starter_code: string;
  dimensions: RubricDimension[];
  pass_threshold: number;
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

  const system = `You are an educational evaluator for the Software Pilotry Foundation Course.
You are scoring exercise "${rubric.title}" (${rubric.exercise_id}).

CONTEXT: The learner was given starter code and asked to:
1. Predict what it would print before running it
2. Run it and compare their prediction
3. Make deliberate modifications (e.g. removing str()) and predict what would change
4. Describe what they changed and what they learned

The learner's descriptions under "Modifications" explain what THEY CHANGED and why — not the original code. Evaluate them in that context.

IMPORTANT for modification_quality: Score based on whether the learner made a deliberate change and understood why the output changed. Do NOT penalise for the size or ambition of the modification. A small, intentional change with a clear explanation scores just as highly as a large one. The exercise does not require major changes.

IMPORTANT for prediction_accuracy: Compare the learner's prediction text against the actual console output. Score based on how closely the prediction matches reality — exact match scores high, partially correct scores medium, completely wrong or missing scores low. If the learner did not write a prediction, score prediction_accuracy no higher than 3.

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
