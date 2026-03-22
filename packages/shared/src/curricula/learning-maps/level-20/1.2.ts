import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "1.2",
  "generated_at": "2024-11-02T10:30:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "Organizations must establish quality gates at specification, automated verification, and human review stages to effectively manage agent-generated code.",
      "concepts": [
        "Designing organizational quality gates",
        "Tier 1 (spot check)",
        "Tier 2 (thorough review)",
        "Tier 3 (deep review)"
      ],
      "demonstration_criteria": "Can design a three-tiered review process for agent-generated code, outlining the criteria for each tier (spot check, thorough review, deep review) and justifying the risk level assignment for example features."
    },
    {
      "id": "claim-2",
      "statement": "Metrics for evaluating agent-assisted development should focus on quality and efficiency of verification, not just the speed of code generation.",
      "concepts": [
        "Metrics that matter",
        "Defect escape rate",
        "Specification completeness score",
        "Verification throughput",
        "Intervention rate",
        "Correlated defect incidents"
      ],
      "demonstration_criteria": "Can analyze a set of metrics (defect escape rate, specification completeness score, verification throughput, intervention rate, correlated defect incidents) from a software project using agent-generated code and identify areas for improvement in the verification process."
    },
    {
      "id": "claim-3",
      "statement": "Prioritizing speed over verification in agent-assisted development leads to increased technical debt and potential production incidents.",
      "concepts": [
        "The false economy of speed"
      ],
      "demonstration_criteria": "Can explain the trade-offs between speed and thoroughness in agent-assisted development and justify the importance of robust verification processes to stakeholders concerned with rapid feature delivery."
    },
    {
      "id": "claim-4",
      "statement": "Specification completeness is a critical input to the quality of agent-generated code and should be verified before code generation begins.",
      "concepts": [
        "Designing organizational quality gates",
        "Specification completeness score"
      ],
      "demonstration_criteria": "Given a software specification, can identify missing elements (e.g., testable requirements, explicit data models, defined error behavior, stated constraints) that would hinder effective verification of agent-generated code."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Agent-generated code is inherently faster and more efficient, so verification can be relaxed.",
      "correction": "While agents can generate code faster, the bottleneck shifts to verification. Relaxing verification leads to increased technical debt and potential production incidents, negating the initial speed gains.",
      "related_claims": [
        "claim-3"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Agent-assisted development shifts the bottleneck from code generation to code verification.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Organizational quality gates are necessary to ensure the quality of agent-generated code.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Metrics should focus on verification quality and efficiency, not just code generation speed.",
      "order": 3
    }
  ]
};
