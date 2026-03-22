import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "4.1",
  "generated_at": "2024-10-26T10:30:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "A well-defined specification includes precise and testable behavior descriptions.",
      "concepts": [],
      "demonstration_criteria": "Given a user story, can rewrite it into a specification with concrete, testable requirements, such as specifying expected inputs, outputs, and side effects."
    },
    {
      "id": "claim-2",
      "statement": "A complete data model specification includes every entity, field, type, and constraint.",
      "concepts": [],
      "demonstration_criteria": "Given a feature description, can define a complete data model including entities, fields with appropriate types, and constraints (e.g., required fields, data validation rules)."
    },
    {
      "id": "claim-3",
      "statement": "A robust specification enumerates and addresses error cases for every happy path.",
      "concepts": [],
      "demonstration_criteria": "Given a happy path scenario, can identify at least three potential failure modes and specify the expected system behavior for each (e.g., error message, retry mechanism, fallback behavior)."
    },
    {
      "id": "claim-4",
      "statement": "Security requirements, including authentication, authorization, input validation, and data protection, must be explicitly specified.",
      "concepts": [],
      "demonstration_criteria": "Given a feature, can identify relevant security requirements and specify how they should be implemented (e.g., authentication method, authorization rules, input validation checks, data encryption)."
    },
    {
      "id": "claim-5",
      "statement": "Acceptance criteria should be defined before development begins and serve as verification targets.",
      "concepts": [],
      "demonstration_criteria": "Given a feature specification, can write clear and measurable acceptance criteria that can be used to verify the implementation."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Vague directives like 'make it good' are sufficient for guiding development.",
      "correction": "Vague directives lead to inconsistent and unpredictable results. Specifications must be precise and measurable to ensure consistent quality.",
      "related_claims": [
        "claim-1"
      ]
    },
    {
      "id": "misconception-2",
      "belief": "'Handle errors appropriately' provides enough guidance for error handling.",
      "correction": "The definition of 'appropriate' is subjective. Specifications must explicitly define the expected behavior for each error case.",
      "related_claims": [
        "claim-3"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Precise specifications minimize ambiguity and ensure everyone is aligned on the desired outcome.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Testable specifications allow for automated verification, reducing the risk of defects.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Comprehensive specifications reduce the need for rework and prevent costly errors.",
      "order": 3
    }
  ]
};
