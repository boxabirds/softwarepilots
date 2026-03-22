import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "2.2",
  "generated_at": "2024-07-10T14:30:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "Effective delegation to agents requires encoding the 'why' behind design decisions to ensure the agent aligns with your intent and expertise.",
      "concepts": [
        "Encoding the \"why\""
      ],
      "demonstration_criteria": "Given a scenario, can rewrite a vague prompt (e.g., 'Store user sessions') into a detailed prompt that includes the reasoning behind specific implementation choices (e.g., using Redis with a TTL for performance and compliance reasons) and explain how the detailed prompt leads to a more desirable outcome."
    },
    {
      "id": "claim-2",
      "statement": "Strategic context management involves including essential information and omitting irrelevant details to optimize the agent's performance within its context window.",
      "concepts": [
        "Context management - what to include, what to omit",
        "Context window management - the practical impact"
      ],
      "demonstration_criteria": "Given a code generation task, can identify which pieces of information are essential to include in the prompt (specification, data model, interfaces) and which are safe to omit (system evolution history, rejected alternatives), and justify their choices."
    },
    {
      "id": "claim-3",
      "statement": "Recognizing the symptoms of context degradation is crucial for maintaining output quality and knowing when to refresh the agent's context.",
      "concepts": [
        "Context window management - the practical impact"
      ],
      "demonstration_criteria": "Can diagnose context degradation by identifying symptoms such as the agent contradicting earlier decisions, reintroducing unwanted patterns, or exhibiting a noticeable decline in output quality, and can demonstrate how starting a new session with fresh context improves results."
    },
    {
      "id": "claim-4",
      "statement": "The decision to iterate on a prompt versus starting over depends on whether the agent's fundamental approach is correct or flawed.",
      "concepts": [
        "The art of the follow-up - iterative refinement vs. starting over"
      ],
      "demonstration_criteria": "Given a scenario where an agent produces incorrect code, can determine whether to iterate on the existing prompt (e.g., to fix a missing validation rule) or start over with a new prompt (e.g., when the agent uses the wrong architectural pattern), and justify their decision based on the nature of the error."
    },
    {
      "id": "claim-5",
      "statement": "Building a personal prompt library by evolving prompts based on past corrections improves efficiency and output quality for similar tasks.",
      "concepts": [
        "Encoding the \"why\"",
        "The art of the follow-up - iterative refinement vs. starting over"
      ],
      "demonstration_criteria": "Given a prompt history with corrections, can create an evolved prompt that incorporates all corrections upfront and explain how this evolved prompt is superior to the original in terms of clarity, completeness, and reduced iteration."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Providing more context always leads to better results.",
      "correction": "Irrelevant context can introduce noise and degrade the agent's performance. Focus on including only essential information.",
      "related_claims": [
        "claim-2"
      ]
    },
    {
      "id": "misconception-2",
      "belief": "If an agent makes a mistake, it's always best to start over with a completely new prompt.",
      "correction": "Iterative refinement is more efficient when the agent's fundamental approach is correct. Starting over is only necessary when the core approach is flawed.",
      "related_claims": [
        "claim-4"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Agents lack inherent understanding of your specific domain expertise and project context.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Encoding your expertise into prompts guides the agent toward solutions aligned with your intent.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Strategic context management optimizes agent performance within the limitations of its context window.",
      "order": 3
    }
  ]
};
