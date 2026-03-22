import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "4.1",
  "generated_at": "2024-10-27T14:32:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "Veteran-level specification involves defining clear boundary contracts, including data types, validation rules, error types, side effects, and performance constraints, for all interfaces between agent-generated components.",
      "concepts": [
        "Boundary contracts"
      ],
      "demonstration_criteria": "Given a system with multiple agent-generated components, the learner can define a boundary contract for the interface between two components, specifying data types, validation rules, error types, side effects, and performance constraints, and write a test to verify the contract."
    },
    {
      "id": "claim-2",
      "statement": "A crucial aspect of system-scale specification is explicitly documenting implicit knowledge, workarounds, and ordering constraints that are currently maintained by convention within the system.",
      "concepts": [
        "Architecture Decision Records (ADRs)"
      ],
      "demonstration_criteria": "Given a description of a legacy system, the learner can identify at least three instances of implicit knowledge, workarounds, or ordering constraints and document them in ADR format."
    },
    {
      "id": "claim-3",
      "statement": "Veteran-level specifications must include non-functional requirements such as performance targets, observability requirements (logging and metrics), and resilience behavior in the face of dependency failures.",
      "concepts": [
        "Risk classification"
      ],
      "demonstration_criteria": "Given a system design, the learner can define specific, measurable performance targets, observability requirements (specifying what to log and which metrics to emit), and resilience strategies for handling dependency failures."
    },
    {
      "id": "claim-4",
      "statement": "Proper decomposition of a system into components with well-defined contracts is essential for preventing integration bugs that are more difficult to resolve than implementation bugs.",
      "concepts": [
        "Boundary contracts"
      ],
      "demonstration_criteria": "Given a poorly decomposed system design, the learner can propose an alternative decomposition with explicit contracts between components, explaining how this decomposition reduces the risk of integration bugs."
    },
    {
      "id": "claim-5",
      "statement": "Architectural constraints should be stated as verifiable rules that can be automatically enforced, such as prohibiting specific import statements between components.",
      "concepts": [
        "Architecture Decision Records (ADRs)"
      ],
      "demonstration_criteria": "Given a set of architectural principles, the learner can translate them into verifiable rules (e.g., using static analysis tools) and demonstrate how these rules can be used to enforce the architectural constraints."
    },
    {
      "id": "claim-6",
      "statement": "Characterization tests are required for any legacy code that an agent will modify to ensure that existing behavior is preserved.",
      "concepts": [
        "Characterization test requirements"
      ],
      "demonstration_criteria": "Given a segment of legacy code, the learner can write a suite of characterization tests that capture the existing behavior of the code, ensuring that any modifications made by an agent do not introduce regressions."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Specification is only about defining the inputs and outputs of individual functions.",
      "correction": "Specification at the veteran level focuses on defining system-scale architecture, component interactions, invariants, and failure modes across boundaries, not just individual function behavior.",
      "related_claims": [
        "claim-1",
        "claim-4"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Specification at the veteran level shifts focus from individual function behavior to system-wide architecture.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Testable constraints are used to express the system-scale architecture.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "The specification defines how components interact and what invariants must hold.",
      "order": 3
    },
    {
      "id": "insight-4",
      "statement": "The specification also defines the failure modes across component boundaries.",
      "order": 4
    }
  ]
};
