import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "3.2",
  "generated_at": "2024-07-03T16:34:22Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "A well-designed verification pipeline uses a layered approach, starting with automated checks and progressing to manual reviews, to efficiently catch different types of errors in agent-generated code.",
      "concepts": [
        "Designing verification pipelines"
      ],
      "demonstration_criteria": "Can design a verification pipeline with at least three distinct layers (e.g., linting, unit tests, manual review) and justify the order and purpose of each layer for a given type of agent-generated code."
    },
    {
      "id": "claim-2",
      "statement": "Property-based testing is a powerful technique for verifying agent-generated code by testing invariants across a wide range of randomly generated inputs, revealing edge cases that traditional unit tests might miss.",
      "concepts": [
        "Property-based testing - your secret weapon"
      ],
      "demonstration_criteria": "Can write a property-based test for a function that sorts a list of numbers, ensuring that the output is always sorted and contains the same elements as the input, regardless of the initial order."
    },
    {
      "id": "claim-3",
      "statement": "Continuous verification in production involves monitoring agent-generated code for shifts in output distributions, error rate increases, performance degradation, and data integrity violations to detect failures that may not have been caught during development.",
      "concepts": [
        "Continuous verification in production"
      ],
      "demonstration_criteria": "Can identify three specific metrics to monitor in production for an agent-generated recommendation engine (e.g., distribution of recommended categories, click-through rate, average recommendation latency) and explain how changes in these metrics could indicate a problem."
    },
    {
      "id": "claim-4",
      "statement": "Automated checks like type checking, linting, and formatting can catch a significant portion of issues in agent-generated code early in the verification pipeline.",
      "concepts": [
        "Designing verification pipelines"
      ],
      "demonstration_criteria": "Can configure a linter (e.g., ESLint for JavaScript) to enforce coding style guidelines on agent-generated code and demonstrate how it identifies and flags violations."
    },
    {
      "id": "claim-5",
      "statement": "Manual review is essential for catching business logic errors and subtle correctness issues that automated checks may miss in agent-generated code.",
      "concepts": [
        "Designing verification pipelines"
      ],
      "demonstration_criteria": "Given a piece of agent-generated code that implements a discount calculation, can identify a specific edge case (e.g., negative input values, large quantities) that could lead to incorrect results and propose a fix."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Manual code review is sufficient for verifying agent-generated code.",
      "correction": "Manual review alone is insufficient due to the volume and complexity of agent-generated code. Automated checks and property-based testing are crucial for catching a wider range of errors efficiently.",
      "related_claims": [
        "claim-1",
        "claim-2"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Verification is not a one-time event, but a continuous process that spans from development to production.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "The speed of code generation is irrelevant if verification is a bottleneck.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Different types of errors require different verification techniques.",
      "order": 3
    }
  ]
};
