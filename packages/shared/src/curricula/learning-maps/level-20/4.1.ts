import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "4.1",
  "generated_at": "2024-10-27T10:30:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "Senior leaders should focus on building organizational infrastructure for specifications, such as templates, rather than writing individual feature specifications.",
      "concepts": [
        "Organizational Specification Strategy"
      ],
      "demonstration_criteria": "Can create a specification template for a new endpoint that includes sections for error behavior, non-functional requirements, acceptance criteria, and security considerations."
    },
    {
      "id": "claim-2",
      "statement": "Specification review should be instituted as a gate before agent delegation, similar to code review before merging.",
      "concepts": [
        "Organizational Specification Strategy"
      ],
      "demonstration_criteria": "Can define a set of review criteria for specifications, including testability, completeness, and unambiguity, and apply these criteria to evaluate a sample specification."
    },
    {
      "id": "claim-3",
      "statement": "Tracking specification quality as a leading indicator helps identify bottlenecks and prioritize investments in specification quality or agent verification.",
      "concepts": [
        "Organizational Specification Strategy"
      ],
      "demonstration_criteria": "Can analyze post-delivery issue data to determine the percentage of issues caused by specification gaps versus agent errors, and recommend appropriate investments based on the analysis."
    },
    {
      "id": "claim-4",
      "statement": "Creating a feedback loop to catalog specification gaps after each feature allows for continuous improvement of specification templates and sharing learnings across teams.",
      "concepts": [
        "Organizational Specification Strategy"
      ],
      "demonstration_criteria": "Can design a process for collecting and cataloging specification gaps identified during feature development and post-delivery, and demonstrate how this information can be used to update specification templates."
    },
    {
      "id": "claim-5",
      "statement": "The depth of specification should be appropriate for the risk tier of the feature, with security-critical, financial, or customer-facing features requiring more detailed specifications.",
      "concepts": [
        "Organizational Specification Strategy"
      ],
      "demonstration_criteria": "Can compare and contrast specification requirements for a low-risk internal tool versus a security-critical customer-facing feature, highlighting the differences in specification depth and threat modeling."
    },
    {
      "id": "claim-6",
      "statement": "Organizations with precise specifications achieve better agent output, leading to less verification, increased throughput, and accelerated learning.",
      "concepts": [
        "Specification as Competitive Advantage"
      ],
      "demonstration_criteria": "Can explain how investing in specification infrastructure creates a positive feedback loop that improves agent output, reduces verification effort, and accelerates feature delivery."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Specification is a one-time cost with limited return on investment.",
      "correction": "Specification infrastructure has compounding returns because better specifications lead to better agent output, less verification, increased throughput, and accelerated learning.",
      "related_claims": [
        "claim-6"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Specification at the senior level is about building systems, not writing individual documents.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Consistent specification quality across an organization requires templates, standards, and review processes.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Investing in specification infrastructure creates a competitive advantage through improved agent output and accelerated learning.",
      "order": 3
    }
  ]
};
