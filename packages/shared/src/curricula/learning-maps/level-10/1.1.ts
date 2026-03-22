import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "1.1",
  "generated_at": "2024-11-03T14:30:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "Reviewing agent-generated code requires a more thorough approach than reviewing human-written code due to the agent's lack of contextual understanding and potential for subtle errors.",
      "concepts": [
        "The review mindset shift"
      ],
      "demonstration_criteria": "Can compare and contrast the review process for human-written code versus agent-generated code, highlighting the increased scrutiny needed for agent output and explaining why."
    },
    {
      "id": "claim-2",
      "statement": "Agent-generated bugs often differ significantly from human-generated bugs, exhibiting patterns like structurally plausible but semantically incorrect logic or the use of non-existent APIs.",
      "concepts": [
        "Agent bugs vs. human bugs - they're categorically different"
      ],
      "demonstration_criteria": "Can identify at least three distinct types of bugs commonly found in agent-generated code that are less frequent in human-written code, providing specific examples for each."
    },
    {
      "id": "claim-3",
      "statement": "Building a personal bug taxonomy specific to agent-generated code within your technology stack is crucial for effective code review.",
      "concepts": [
        "Agent bugs vs. human bugs - they're categorically different"
      ],
      "demonstration_criteria": "Can create a bug taxonomy with at least five categories of agent-generated bugs observed in a specific technology stack, and explain how this taxonomy informs the code review process."
    },
    {
      "id": "claim-4",
      "statement": "The 'routine' of an agent is based on statistical patterns from millions of codebases, not the specific conventions and constraints of your codebase, making routine decisions a source of hidden problems.",
      "concepts": [
        "The review mindset shift"
      ],
      "demonstration_criteria": "Can analyze a piece of agent-generated code and identify a potential issue arising from the agent applying a common coding pattern that conflicts with a specific convention or constraint of a given codebase."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Reviewing agent-generated code is faster because agents don't make simple mistakes.",
      "correction": "Agent-generated code requires more thorough review because agents can introduce subtle, context-dependent errors that are less common in human-written code.",
      "related_claims": [
        "claim-1",
        "claim-2"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Your existing code review instincts are valuable, but need to be adapted to the unique characteristics of agent-generated code.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Agent-generated code has a different distribution of bug types than human-written code.",
      "order": 2
    }
  ]
};
