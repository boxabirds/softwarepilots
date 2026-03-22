import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "2.2",
  "generated_at": "2024-02-29T18:22:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "A precise specification reduces variance in agent output, leading to faster development cycles.",
      "concepts": [
        "The specification spectrum",
        "The ambiguity-variance relationship"
      ],
      "demonstration_criteria": "Can compare the output of an agent given a vague specification versus a precise specification for the same feature, quantifying the reduction in required rework time."
    },
    {
      "id": "claim-2",
      "statement": "Effective pilotry involves strategically specifying critical aspects while allowing the agent flexibility in less crucial areas.",
      "concepts": [
        "Always specify",
        "Often leave open",
        "Never leave open"
      ],
      "demonstration_criteria": "Can categorize a list of development tasks (e.g., data validation, UI styling, API endpoint definition) into 'Always Specify', 'Often Leave Open', and 'Never Leave Open' categories, justifying each categorization."
    },
    {
      "id": "claim-3",
      "statement": "Prompting is an iterative process of refinement, where each iteration informs and improves the specification.",
      "concepts": [
        "The iterative refinement loop"
      ],
      "demonstration_criteria": "Given an initial agent output, can identify at least three decisions made by the agent that require further specification and refine the prompt accordingly to achieve the desired outcome."
    },
    {
      "id": "claim-4",
      "statement": "Specifying data models and API contracts upfront is crucial for ensuring consistency and preventing integration issues.",
      "concepts": [
        "Always specify",
        "The specification spectrum"
      ],
      "demonstration_criteria": "Can define a data model with appropriate data types and constraints for a given feature (e.g., user profile, product catalog) and translate it into an API contract using a standard format like OpenAPI."
    },
    {
      "id": "claim-5",
      "statement": "Ambiguity in specifications leads to increased variance in agent output, resulting in more time spent on evaluation and correction.",
      "concepts": [
        "The ambiguity-variance relationship",
        "The specification spectrum"
      ],
      "demonstration_criteria": "Can analyze two specifications for the same feature, identify the ambiguities in one specification, and predict how those ambiguities will manifest as variance in the agent's output."
    },
    {
      "id": "claim-6",
      "statement": "Security requirements, anything involving money, authentication, data deletion, or external service integration should never be left open in a specification.",
      "concepts": [
        "Never leave open"
      ],
      "demonstration_criteria": "Given a scenario involving user authentication, can identify potential security vulnerabilities arising from unspecified aspects of the authentication process and propose specific constraints to mitigate those vulnerabilities."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Spending time on detailed specifications is inefficient and slows down development.",
      "correction": "Detailed specifications are an investment that reduces rework and ensures the agent produces the desired outcome, ultimately accelerating development.",
      "related_claims": [
        "claim-1",
        "claim-5"
      ]
    },
    {
      "id": "misconception-2",
      "belief": "The agent can infer the desired behavior, so detailed specifications are unnecessary.",
      "correction": "While agents can make reasonable defaults, relying on inference introduces variance and increases the risk of the agent making incorrect assumptions about critical aspects of the application.",
      "related_claims": [
        "claim-2",
        "claim-5"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Precise specifications minimize wasted effort by guiding the agent towards the desired outcome from the start.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Iterative refinement allows you to progressively eliminate ambiguity and converge on a specification that accurately reflects your intent.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Strategic specification focuses effort on the areas that have the greatest impact on the application's functionality and reliability.",
      "order": 3
    }
  ]
};
