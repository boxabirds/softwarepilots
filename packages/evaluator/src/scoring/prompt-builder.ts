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
  content: SubmissionContent,
  systemTemplate: string
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

  const system = systemTemplate;

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
