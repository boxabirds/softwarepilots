import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "3.1",
  "generated_at": "2024-07-10T14:30:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "A good specification includes context, requirements, a data model, error behavior, and acceptance criteria, each serving a distinct purpose in guiding agent behavior and ensuring verifiable outcomes.",
      "concepts": [
        "The anatomy of a good specification",
        "Context",
        "Requirements",
        "Data model",
        "Error behavior",
        "Acceptance criteria"
      ],
      "demonstration_criteria": "Given a scenario, can identify and describe the necessary components of a complete specification, including context, requirements, data model, error behavior, and acceptance criteria."
    },
    {
      "id": "claim-2",
      "statement": "The data model is the most critical part of a specification because ambiguities in the data model lead to the most significant errors in agent behavior.",
      "concepts": [
        "Data model"
      ],
      "demonstration_criteria": "Can explain why an ambiguous data model is more likely to cause errors in agent behavior compared to ambiguities in other parts of the specification, providing specific examples."
    },
    {
      "id": "claim-3",
      "statement": "The 'spec first' discipline involves writing a complete specification before implementing any code, which helps uncover hidden assumptions and edge cases.",
      "concepts": [
        "The discipline of \"spec first\""
      ],
      "demonstration_criteria": "Can describe the benefits of the 'spec first' approach and explain how it helps to identify and address potential issues before implementation begins."
    },
    {
      "id": "claim-4",
      "statement": "Requirements should be stated in testable terms to ensure that the software's behavior can be verified against the specification.",
      "concepts": [
        "Requirements"
      ],
      "demonstration_criteria": "Can rewrite a vague requirement (e.g., 'The system should be fast') into a testable requirement (e.g., 'The system should respond in under 200ms at p95 for 1000 concurrent users')."
    },
    {
      "id": "claim-5",
      "statement": "Error behavior must be explicitly specified to prevent agents from ignoring errors or handling them in ways that hide problems.",
      "concepts": [
        "Error behavior"
      ],
      "demonstration_criteria": "Given a scenario with a potential error, can describe what errors are possible, what the user should see, what should be logged, and whether the operation should retry."
    },
    {
      "id": "claim-6",
      "statement": "Acceptance criteria should be written before the agent starts working to serve as test cases for verifying the implementation.",
      "concepts": [
        "Acceptance criteria"
      ],
      "demonstration_criteria": "Can create a set of acceptance criteria for a given feature specification that can be used to verify its correct implementation."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Writing a detailed specification is a waste of time because agents can adapt and iterate towards the desired behavior.",
      "correction": "In the agent era, a precise specification is crucial for ensuring correct and predictable behavior. Ambiguous specifications lead to unpredictable and potentially incorrect outcomes.",
      "related_claims": [
        "claim-1",
        "claim-3"
      ]
    },
    {
      "id": "misconception-2",
      "belief": "The data model is less important than the functional requirements in a specification.",
      "correction": "The data model is paramount because it defines the entities, their attributes, and relationships, which directly impacts how the agent interprets and manipulates data. Ambiguities here lead to significant errors.",
      "related_claims": [
        "claim-2"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "In the agent era, precise specification replaces iterative coding as the primary method for achieving desired software behavior.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "A comprehensive specification acts as a contract between the developer and the agent, ensuring clarity and alignment on expected outcomes.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Writing a specification forces you to confront and resolve ambiguities that would otherwise lead to errors during agent execution.",
      "order": 3
    }
  ]
};
