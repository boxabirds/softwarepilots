import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "5.1",
  "generated_at": "2024-07-10T10:30:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "Senior leaders are responsible for establishing and maintaining verification checklists, not for personally executing them.",
      "concepts": [
        "Checklist compliance tracking",
        "Checklist evolution"
      ],
      "demonstration_criteria": "Can explain the difference between a senior leader's role in verification and a developer's role, focusing on governance versus execution."
    },
    {
      "id": "claim-2",
      "statement": "Risk tier assignment is a critical step in the verification process and should occur during specification review, prior to code review.",
      "concepts": [
        "Tier assignment"
      ],
      "demonstration_criteria": "Can justify assigning a specific risk tier (standard, elevated, critical) to a given agent-generated code change request based on its potential impact."
    },
    {
      "id": "claim-3",
      "statement": "Checklist compliance tracking provides valuable insights into process gaps and overall verification effectiveness.",
      "concepts": [
        "Checklist compliance tracking"
      ],
      "demonstration_criteria": "Can analyze checklist compliance data to identify potential process gaps and propose corrective actions."
    },
    {
      "id": "claim-4",
      "statement": "Verification checklists should be regularly reviewed and updated based on incident post-mortems and evolving organizational needs.",
      "concepts": [
        "Checklist evolution"
      ],
      "demonstration_criteria": "Can propose modifications to a verification checklist based on a provided incident post-mortem report."
    },
    {
      "id": "claim-5",
      "statement": "Automation of verification checks should be prioritized to improve efficiency and consistency, especially for standard checks.",
      "concepts": [
        "Automation targets"
      ],
      "demonstration_criteria": "Can identify verification checks that are suitable for automation and describe the benefits of automating them."
    },
    {
      "id": "claim-6",
      "statement": "Organizational verification governance involves defining risk tiers, tracking compliance, evolving checklists, and setting automation targets.",
      "concepts": [
        "Tier assignment",
        "Checklist compliance tracking",
        "Checklist evolution",
        "Automation targets"
      ],
      "demonstration_criteria": "Can design a basic organizational verification governance plan that includes tier assignment guidelines, compliance tracking metrics, a checklist evolution process, and automation goals."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Senior leaders must personally review every line of agent-generated code.",
      "correction": "Senior leaders are responsible for ensuring the existence and effectiveness of verification processes, not for personally executing every check.",
      "related_claims": [
        "claim-1"
      ]
    },
    {
      "id": "misconception-2",
      "belief": "Risk tier assignment can be determined during code review.",
      "correction": "Risk tier assignment should occur during specification review, before code is written, to ensure appropriate verification measures are in place from the start.",
      "related_claims": [
        "claim-2"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Effective verification governance ensures that agent-generated code meets quality and security standards.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Checklists provide a structured approach to verifying code, reducing the risk of errors and vulnerabilities.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Automation improves the efficiency and consistency of verification, freeing up human reviewers to focus on more complex issues.",
      "order": 3
    }
  ]
};
