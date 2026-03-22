import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "1.2",
  "generated_at": "2024-07-10T14:30:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "Architectural patterns should be enforced through verifiable constraints rather than named patterns when using agents.",
      "concepts": [
        "Encoding architectural decisions - constraints, not suggestions"
      ],
      "demonstration_criteria": "Can rewrite a pattern-based architectural guideline (e.g., 'use hexagonal architecture') into a set of verifiable constraints (e.g., 'all database access must go through the Repository interface')."
    },
    {
      "id": "claim-2",
      "statement": "Explicit interface contracts are crucial for preventing integration issues when decomposing a system and assigning components to different agent sessions.",
      "concepts": [
        "System boundaries and contracts"
      ],
      "demonstration_criteria": "Can define a contract for a simple API endpoint, specifying input types, output types, error types, and performance constraints."
    },
    {
      "id": "claim-3",
      "statement": "The decision of whether to decompose a task yourself or delegate it to an agent depends on the agent's knowledge of the system, the risk of incorrect decomposition, and the complexity of interdependencies.",
      "concepts": [
        "The decomposition problem - when to decompose yourself vs. let the agent do it"
      ],
      "demonstration_criteria": "Given a software engineering task, can justify whether to decompose the task manually or delegate it to an agent, based on factors like domain knowledge and potential risks."
    },
    {
      "id": "claim-4",
      "statement": "Incorrect agent decomposition can be identified by an excessive number of abstractions, violation of cohesion, incorrect grouping of components, circular dependencies, or misplacement of complex logic.",
      "concepts": [
        "The decomposition problem - when to decompose yourself vs. let the agent do it"
      ],
      "demonstration_criteria": "Can diagnose a flawed agent decomposition by identifying issues such as excessive abstractions, violation of cohesion, or circular dependencies in a code architecture diagram."
    },
    {
      "id": "claim-5",
      "statement": "Architectural decisions should be encoded as constraints to prevent agents from violating invariants.",
      "concepts": [
        "Encoding architectural decisions - constraints, not suggestions"
      ],
      "demonstration_criteria": "Can identify a scenario where an agent's implementation violates a hidden architectural constraint and propose a verifiable constraint to prevent future violations."
    },
    {
      "id": "claim-6",
      "statement": "Well-defined system boundaries and contracts are essential for successful agent-assisted development.",
      "concepts": [
        "System boundaries and contracts"
      ],
      "demonstration_criteria": "Can design a set of interface contracts for a microservice architecture, including input/output validation, error handling, and performance requirements."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Agents inherently understand and enforce architectural patterns when instructed by name.",
      "correction": "Agents reproduce the surface of patterns but may violate underlying constraints. Explicit, verifiable constraints are necessary.",
      "related_claims": [
        "claim-1",
        "claim-5"
      ]
    },
    {
      "id": "misconception-2",
      "belief": "Decomposing tasks and assigning them to agents is always more efficient than manual decomposition.",
      "correction": "Incorrect agent decomposition can lead to wasted work and integration issues. Manual decomposition is preferable when the decomposition depends on knowledge the agent lacks or when the components have complex interdependencies.",
      "related_claims": [
        "claim-3",
        "claim-4"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Agents excel at pattern matching but lack inherent architectural understanding.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Constraints are more effective than suggestions in guiding agent behavior.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Precise contracts are essential for seamless integration of agent-generated components.",
      "order": 3
    },
    {
      "id": "insight-4",
      "statement": "Strategic decomposition is a key skill for leveraging agents effectively.",
      "order": 4
    }
  ]
};
