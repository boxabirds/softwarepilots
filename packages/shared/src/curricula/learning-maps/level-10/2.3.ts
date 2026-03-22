import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "2.3",
  "generated_at": "2024-11-03T14:35:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "Agents are generally reliable for standard CRUD operations, boilerplate code generation, and well-documented API integrations.",
      "concepts": [
        "Building intuition for *when* agents will fail"
      ],
      "demonstration_criteria": "Can identify three examples of tasks where an agent would reliably generate correct code, such as generating boilerplate code for a new API endpoint or implementing a simple CRUD operation."
    },
    {
      "id": "claim-2",
      "statement": "Agents are unreliable at tasks involving complex business logic, state management, performance-critical code, and security-critical code.",
      "concepts": [
        "Building intuition for *when* agents will fail"
      ],
      "demonstration_criteria": "Can explain why agents struggle with tasks requiring understanding of state over time, such as implementing a caching strategy or managing user sessions."
    },
    {
      "id": "claim-3",
      "statement": "Agent output quality degrades non-linearly with task complexity, exhibiting a 'cliff' where performance drops sharply.",
      "concepts": [
        "Complexity thresholds - the nonlinear degradation"
      ],
      "demonstration_criteria": "Can design an experiment to determine the complexity threshold for a specific task, such as generating unit tests for a function with increasing levels of nested conditional statements, and document the point at which the agent's output becomes unreliable."
    },
    {
      "id": "claim-4",
      "statement": "Subtle correctness failures in agent output often manifest as bugs that pass tests but violate business logic in production.",
      "concepts": [
        "Detecting subtle correctness failures"
      ],
      "demonstration_criteria": "Can diagnose a subtle correctness failure in agent-generated code, such as a discount calculation that applies discounts in the wrong order, by analyzing the code's behavior in a production-like environment with realistic data."
    },
    {
      "id": "claim-5",
      "statement": "When an agent is in a fixation loop, the recommended intervention is to start a new session with the original specification, the broken code, and a clear description of the problem.",
      "concepts": [
        "Intervention patterns that work"
      ],
      "demonstration_criteria": "Given an example of an agent stuck in a fixation loop, can demonstrate the process of starting a new session with the appropriate context and problem description to guide the agent towards a correct solution."
    },
    {
      "id": "claim-6",
      "statement": "When the agent's approach is wrong but salvageable, provide specific feedback explaining what's wrong and why, along with the correct approach if known.",
      "concepts": [
        "Intervention patterns that work"
      ],
      "demonstration_criteria": "Given an example of an agent generating code with a flawed approach, can provide specific feedback that identifies the error, explains the underlying reason for the error, and suggests a correct alternative approach."
    },
    {
      "id": "claim-7",
      "statement": "When unsure if the agent's output is correct, ask the agent to explain its reasoning by walking through the execution path for specific inputs.",
      "concepts": [
        "Intervention patterns that work"
      ],
      "demonstration_criteria": "Given a piece of agent-generated code, can elicit a detailed explanation of its execution path for specific inputs and identify potential gaps or inconsistencies in the agent's reasoning."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "If the agent-generated code passes all unit tests, it is guaranteed to be correct.",
      "correction": "Passing unit tests does not guarantee correctness, as tests may not cover all edge cases or business logic requirements. Subtle correctness failures can still occur.",
      "related_claims": [
        "claim-4"
      ]
    },
    {
      "id": "misconception-2",
      "belief": "Agent output quality degrades linearly with task complexity.",
      "correction": "Agent output quality degrades non-linearly with task complexity. There is a complexity threshold where performance drops sharply.",
      "related_claims": [
        "claim-3"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Understanding the types of tasks agents excel at and struggle with is crucial for effective delegation.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Recognizing the 'complexity cliff' helps avoid wasting time on tasks beyond the agent's capabilities.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Experience in debugging subtle correctness failures translates directly to overseeing agent-generated code.",
      "order": 3
    }
  ]
};
