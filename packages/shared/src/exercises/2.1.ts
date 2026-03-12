import type { ExerciseDefinition } from "../exercises";

export const exercise_2_1: ExerciseDefinition = {
  content_type: "interactive-sandbox",
  sandbox: "pyodide",
  meta: {
    id: "2.1",
    title: "The Compiler Moment",
    starter_code: `price = 10
tax = price * 0.2
label = "Total: " + str(price + tax)
cheap = price < 5
print(label, "| Cheap?", cheap)`,
    topics: [
      "variable assignment",
      "arithmetic operators",
      "string concatenation",
      "str() type conversion",
      "boolean comparison",
      "print() function",
      "TypeError when mixing types",
    ],
    module_description:
      "The compiler moment — software is precise, literal, and layered. The learner experiences the machine executing exact instructions.",
  },
  content: {
    intro: {
      welcome: [
        "You're about to look at 5 lines of Python. You don't need to know Python \u2014 just read each line carefully and try to figure out what it does.",
        "This exercise is about feeling how precise a computer is. It does exactly what it's told, nothing more, nothing less.",
        "You'll predict what the code will do, run it, and see if you were right. When you're ready, hit the button below.",
      ],
    },
    steps: [
      {
        type: "predict",
        prompt: "Read the code. **What do you think it will print?**",
        inputPlaceholder: "Type what you think the output will be\u2026",
      },
      {
        type: "experiment",
        prompt: "Now try removing `str()` from line 3 and run again. What happens?",
      },
      {
        type: "edit-and-predict",
        prompt: "Make one more change of your own. **What do you think will happen?**",
        inputPlaceholder: "What do you predict will happen?",
      },
      {
        type: "reflect",
        prompt: "**What did you change, and what did you learn?**",
        inputPlaceholder:
          "Describe what you changed and what you learned\u2026",
      },
    ],
  },
  rubric: {
    dimensions: [
      {
        key: "code_comprehension",
        weight: 0.4,
        description:
          "Does the learner understand what each line does? Can they explain the role of variable assignment, arithmetic, str() conversion, conditional evaluation, and print output?",
        label: "Code Comprehension",
        self_assessment_description:
          "How well could you explain what each line does to someone else?",
      },
      {
        key: "prediction_accuracy",
        weight: 0.3,
        description:
          "Did the learner accurately predict the output before running the code? Did they anticipate the TypeError when removing str()?",
        label: "Output Predictions",
        self_assessment_description:
          "When you predicted what the code would print, how often were you right?",
      },
      {
        key: "modification_quality",
        weight: 0.3,
        description:
          "Was the modification intentional and purposeful? Does the learner explain what they changed and why the output changed?",
        label: "Your Modification",
        self_assessment_description:
          "How deliberate was your change \u2014 did you know what would happen before you ran it?",
      },
    ],
    pass_threshold: 0.6,
    step_summary:
      "The learner was given starter code and asked to: predict the output before running it, run it and compare their prediction, make deliberate modifications (e.g. removing str()) and predict what would change, then describe what they changed and what they learned.",
    scoring_guidance: {
      modification_quality:
        "Score based on whether the learner made a deliberate change and understood why the output changed. Do NOT penalise for the size or ambition of the modification. A small, intentional change with a clear explanation scores just as highly as a large one. The exercise does not require major changes.",
      prediction_accuracy:
        "Compare the learner's prediction text against the actual console output. Score based on how closely the prediction matches reality \u2014 exact match scores high, partially correct scores medium, completely wrong or missing scores low. If the learner did not write a prediction, score prediction_accuracy no higher than 3.",
    },
  },
};
