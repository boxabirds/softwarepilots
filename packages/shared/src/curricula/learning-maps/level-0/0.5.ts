import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "0.5",
  "generated_at": "2024-10-27T14:32:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "All agent-generated code must pass a standard set of checks to ensure basic functionality and security.",
      "concepts": [
        "Does it compile/run without errors?",
        "Does it do what was specified?",
        "Are there hardcoded secrets?",
        "Are dependencies necessary and current?",
        "Are errors handled, not swallowed?",
        "Is input validated?",
        "Are resources cleaned up?",
        "Do the tests test the right things?"
      ],
      "demonstration_criteria": "Given a piece of agent-generated code, the learner can systematically apply the eight standard checks and identify any violations."
    },
    {
      "id": "claim-2",
      "statement": "Business logic requires elevated verification to ensure correct implementation of business rules and handling of edge cases.",
      "concepts": [
        "Are business rules implemented in the correct order?",
        "Are edge cases at business boundaries handled?",
        "Is the logic consistent with existing business rules elsewhere in the system?",
        "Are rounding and precision handled correctly?",
        "Is the business logic testable in isolation?"
      ],
      "demonstration_criteria": "Given a code snippet implementing business logic, the learner can identify potential issues related to rule order, edge case handling, consistency with existing rules, and rounding/precision errors."
    },
    {
      "id": "claim-3",
      "statement": "Security and financial code demands critical verification to protect sensitive data and prevent vulnerabilities.",
      "concepts": [
        "Is authentication checked on every protected endpoint?",
        "Is authorization granular?",
        "Is sensitive data encrypted in transit and at rest?",
        "Are audit trails complete?",
        "Has the code been tested with adversarial inputs?"
      ],
      "demonstration_criteria": "Given a code snippet handling authentication or financial transactions, the learner can identify potential security vulnerabilities related to authentication, authorization, data encryption, audit trails, and adversarial inputs."
    },
    {
      "id": "claim-4",
      "statement": "Dependencies introduced by agents should be carefully reviewed for necessity, maintenance, and known vulnerabilities.",
      "concepts": [
        "Are dependencies necessary and current?"
      ],
      "demonstration_criteria": "Given a list of dependencies added by an agent, the learner can justify the necessity of each dependency, assess its maintenance status, and identify any known vulnerabilities using a vulnerability database."
    },
    {
      "id": "claim-5",
      "statement": "Proper error handling is crucial to prevent unexpected behavior and maintain system stability.",
      "concepts": [
        "Are errors handled, not swallowed?"
      ],
      "demonstration_criteria": "Given a code snippet, the learner can identify instances where errors are swallowed (e.g., empty catch blocks) or not handled appropriately, and suggest improvements for robust error handling."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "If the code compiles and runs, it is likely correct.",
      "correction": "Compiling and running are necessary but not sufficient conditions for correctness. The code must also adhere to specifications, handle errors, and avoid security vulnerabilities.",
      "related_claims": [
        "claim-1",
        "claim-2",
        "claim-3"
      ]
    },
    {
      "id": "misconception-2",
      "belief": "Testing only needs to exercise the code, not verify the specification.",
      "correction": "Tests must verify that the code meets the specification. Tests that pass when the code is wrong are worse than no tests at all.",
      "related_claims": [
        "claim-1"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Agent-generated code requires tiered verification because the risk associated with different types of code varies significantly.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Standard checks provide a baseline level of assurance for all code, regardless of its purpose.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Elevated and critical checks address specific risks associated with business logic and security/financial code, respectively.",
      "order": 3
    }
  ]
};
