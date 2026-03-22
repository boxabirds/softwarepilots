import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "5.1",
  "generated_at": "2024-01-09T16:35:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "All code, regardless of its function, must pass standard verification checks to ensure basic functionality and security.",
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
      "demonstration_criteria": "Given a code snippet, the learner can identify at least 6 out of the 8 standard verification checks that need to be performed and explain how to perform them."
    },
    {
      "id": "claim-2",
      "statement": "Business logic requires elevated verification to ensure that it adheres to business rules and handles edge cases correctly.",
      "concepts": [
        "Are business rules in the correct order?",
        "Are edge cases at business boundaries handled?",
        "Is the logic consistent with existing business rules?",
        "Are rounding and precision correct?",
        "Is business logic testable in isolation?"
      ],
      "demonstration_criteria": "Given a piece of business logic code, the learner can identify potential edge cases and demonstrate how to write tests to cover them."
    },
    {
      "id": "claim-3",
      "statement": "Security and financial code require critical verification to protect sensitive data and prevent vulnerabilities.",
      "concepts": [
        "Is authentication checked on every protected endpoint?",
        "Is authorization granular?",
        "Is sensitive data encrypted in transit and at rest?",
        "Are audit trails complete?",
        "Has the code been tested with adversarial inputs?"
      ],
      "demonstration_criteria": "Given a code snippet that handles sensitive data, the learner can identify at least three potential security vulnerabilities and propose solutions to mitigate them."
    },
    {
      "id": "claim-4",
      "statement": "Proper error handling is crucial to prevent unexpected application behavior and maintain system stability.",
      "concepts": [
        "Are errors handled, not swallowed?"
      ],
      "demonstration_criteria": "The learner can refactor code containing empty catch blocks or generic log-and-continue patterns to implement robust error handling that provides meaningful feedback and prevents data loss."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Standard verification is sufficient for all types of code.",
      "correction": "Standard verification is a baseline, but business logic and security/financial code require more in-depth checks.",
      "related_claims": [
        "claim-1",
        "claim-2",
        "claim-3"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Verification depth should be proportional to the risk associated with the code's function.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Checklists provide a structured approach to ensure thorough verification.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Automated testing is essential, but manual review is still necessary for critical code.",
      "order": 3
    }
  ]
};
