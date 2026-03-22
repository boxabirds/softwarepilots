import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "6.1",
  "generated_at": "2024-07-10T18:30:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [
    "Module 1, section 1.1",
    "Module 1, section 1.2",
    "Module 1, section 1.3",
    "Module 2, section 2.1",
    "Module 2, section 2.3",
    "Module 3, section 3.2"
  ],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "Building a bug taxonomy helps identify and categorize agent failure modes in your specific stack.",
      "concepts": [
        "Bug Taxonomy Building"
      ],
      "demonstration_criteria": "Can construct a bug taxonomy with at least 10 categorized entries, each including a specific detection strategy applicable to their codebase."
    },
    {
      "id": "claim-2",
      "statement": "Extracting architectural constraints ensures that new team members or agents do not violate implicit rules within a system.",
      "concepts": [
        "Architecture Constraint Extraction"
      ],
      "demonstration_criteria": "Can produce a document detailing undocumented architectural constraints such that a new team member or agent, using only the document, will not violate any implicit rules of the system."
    },
    {
      "id": "claim-3",
      "statement": "Mapping the riskiest module in your codebase allows for safer agent modifications by defining agent-safe boundaries.",
      "concepts": [
        "Legacy Risk Assessment"
      ],
      "demonstration_criteria": "Can create a comprehensive map of a risky module, detailing its obvious behavior, hidden behavior, implicit contracts, and agent-safe boundaries, suitable for use as an agent specification."
    },
    {
      "id": "claim-4",
      "statement": "Decomposing features into macro-action-sized chunks with specifications enables correct agent implementation and predictable failure handling.",
      "concepts": [
        "Macro Action Sizing"
      ],
      "demonstration_criteria": "Can break down a real feature into macro-action-sized chunks, each with a specification precise enough for correct agent implementation and a verification plan that catches predicted failures."
    },
    {
      "id": "claim-5",
      "statement": "Cliff mapping helps determine the complexity threshold where agent output quality degrades, allowing for better delegation decisions.",
      "concepts": [
        "Cliff Mapping"
      ],
      "demonstration_criteria": "Can document cliff points for at least three frequently delegated task types, enabling prediction of delegation success before starting."
    },
    {
      "id": "claim-6",
      "statement": "Designing a verification pipeline ensures the quality and reliability of agent-generated code.",
      "concepts": [
        "Verification Pipeline Design"
      ],
      "demonstration_criteria": "Can design and document a complete verification pipeline for a common agent-generated code type, including automated and manual stages, risk-calibrated review depth, and measurable throughput targets."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Simulation readiness is about theoretical knowledge, not practical application.",
      "correction": "Simulation readiness markers are specifically designed to test real-world pilotry skills in your own stack and codebase, requiring practical application of learned concepts.",
      "related_claims": [
        "claim-1",
        "claim-2",
        "claim-3",
        "claim-4",
        "claim-5",
        "claim-6"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Simulation readiness markers provide concrete exercises to test pilotry skills.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "These exercises are designed to be performed in your own stack and codebase.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "The markers map veteran-level curriculum progress to real-world application.",
      "order": 3
    }
  ]
};
