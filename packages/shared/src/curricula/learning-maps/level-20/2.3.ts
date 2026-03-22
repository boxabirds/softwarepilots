import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "2.3",
  "generated_at": "2024-10-27T14:32:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "Organizations should standardize agent usage by defining specification formats, verification pipelines, risk classifications, data governance policies, and metrics, while allowing flexibility in agent selection, interaction methods, and work decomposition.",
      "concepts": [
        "Standardizing without killing innovation",
        "Verification cost",
        "Data governance and security policies"
      ],
      "demonstration_criteria": "Can design a standardization framework for agent usage that specifies mandatory elements like specification format and verification pipelines, while also identifying areas where teams can retain flexibility, such as agent selection and prompt engineering techniques."
    },
    {
      "id": "claim-2",
      "statement": "High-quality internal documentation, especially in formats easily parsed by agents, directly improves the quality of agent-generated code by providing necessary context and constraints.",
      "concepts": [
        "Knowledge management - documentation as agent interface",
        "Quality"
      ],
      "demonstration_criteria": "Given a poorly documented API endpoint, can rewrite the documentation to include examples, constraints, and common error cases, and then demonstrate how an agent's output improves when using the revised documentation compared to the original."
    },
    {
      "id": "claim-3",
      "statement": "Measuring agent effectiveness requires considering not just throughput, but also quality, verification cost, and total cost of ownership to avoid accruing technical debt.",
      "concepts": [
        "Throughput",
        "Quality",
        "Verification cost",
        "Total cost of ownership",
        "Measuring agent effectiveness honestly"
      ],
      "demonstration_criteria": "Can calculate the total cost of ownership for a feature developed with agent assistance, considering agent generation time, verification time, debugging time, and incident resolution time, and compare it to the estimated cost without agent assistance."
    },
    {
      "id": "claim-4",
      "statement": "Migrating internal documentation to agent-friendly formats like Markdown and ensuring API documentation includes examples and constraints can significantly improve agent output quality.",
      "concepts": [
        "Knowledge management - documentation as agent interface",
        "Quality"
      ],
      "demonstration_criteria": "Can convert a section of internal documentation from HTML to Markdown, add examples and constraints to an API endpoint documentation, and demonstrate the improved quality of agent-generated code using the updated documentation."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Increased throughput with agents automatically translates to faster software delivery.",
      "correction": "Increased throughput must be balanced with quality and verification costs. If quality decreases or verification costs increase proportionally, the overall benefit is negated.",
      "related_claims": [
        "claim-3"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Balancing standardization and flexibility allows organizations to leverage the benefits of AI agents without stifling innovation.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Documentation serves as the primary interface between human knowledge and AI agents, making its quality crucial for agent effectiveness.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Honest measurement of agent effectiveness requires considering throughput, quality, verification cost, and total cost of ownership.",
      "order": 3
    }
  ]
};
