import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "0.4",
  "generated_at": "2024-10-27T14:35:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "Before building anything, you should be able to describe its behavior in a single sentence.",
      "concepts": [
        "What does it do?"
      ],
      "demonstration_criteria": "Given a description of a software component, can formulate a single-sentence summary of its primary function."
    },
    {
      "id": "claim-2",
      "statement": "Identifying potential failure modes is crucial for robust system design.",
      "concepts": [
        "Failure before success",
        "What can go wrong?"
      ],
      "demonstration_criteria": "Given a simple system description, can list at least three potential failure modes and explain their impact."
    },
    {
      "id": "claim-3",
      "statement": "Defining the interface and data flow (boundaries) is more important initially than the internal implementation details.",
      "concepts": [
        "Boundaries before internals",
        "What data does it use?"
      ],
      "demonstration_criteria": "Given a system requirement, can define the input data types, output data types, and the expected data flow before describing the internal logic."
    },
    {
      "id": "claim-4",
      "statement": "Understanding who will use the system dictates the interface and interaction patterns.",
      "concepts": [
        "Who uses it?"
      ],
      "demonstration_criteria": "Given a description of a software tool, can describe the user persona (e.g., data scientist, web user) and explain how their needs influence the design of the user interface or API."
    },
    {
      "id": "claim-5",
      "statement": "Defining clear success criteria before development allows for objective verification of the system's correctness.",
      "concepts": [
        "How do you know it works?"
      ],
      "demonstration_criteria": "Given a system requirement, can define specific, measurable, achievable, relevant, and time-bound (SMART) criteria to verify that the system is working correctly."
    },
    {
      "id": "claim-6",
      "statement": "Constraints provide a more effective starting point for design than abstract goals.",
      "concepts": [
        "Constraint-first thinking"
      ],
      "demonstration_criteria": "Given a design problem, can identify relevant constraints (e.g., performance, security, cost) and explain how these constraints limit the possible solutions."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Implementation details should be considered before defining the system's boundaries.",
      "correction": "Defining the system's boundaries (inputs, outputs, and data flow) before considering implementation details ensures a clear contract and prevents unnecessary complexity.",
      "related_claims": [
        "claim-3"
      ]
    },
    {
      "id": "misconception-2",
      "belief": "Focusing on success scenarios is sufficient for building a reliable system.",
      "correction": "Considering potential failure modes is crucial for building a robust system that can handle unexpected situations gracefully.",
      "related_claims": [
        "claim-2"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Thinking habits are more important than production specifications at the beginning.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "The five questions provide a structured approach to thinking about system design.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Answering the five questions helps to build a foundation for writing effective specifications later.",
      "order": 3
    }
  ]
};
