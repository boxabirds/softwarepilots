import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "3.3",
  "generated_at": "2024-10-27T14:32:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "The primary value of a software engineer in the age of AI agents shifts from writing code to evaluating and overseeing agent-generated code.",
      "concepts": [
        "Why the shift is hard",
        "Knowing when to take the controls"
      ],
      "demonstration_criteria": "Can explain the difference between the value derived from direct code creation versus the value derived from evaluating agent-created code, providing specific examples of scenarios where each is more valuable."
    },
    {
      "id": "claim-2",
      "statement": "A software pilot must develop the judgment to know when to delegate tasks to AI agents and when to take direct control and write the code themselves.",
      "concepts": [
        "Knowing when to take the controls",
        "The analog is real pilotry"
      ],
      "demonstration_criteria": "Given a set of software development scenarios, can correctly identify whether the task should be delegated to an agent or handled directly, justifying the decision based on factors like problem complexity, security criticality, and time efficiency."
    },
    {
      "id": "claim-3",
      "statement": "Veteran software engineers have a responsibility to mentor junior engineers on how to critically evaluate code, reason about systems, and debug effectively in an AI-assisted environment.",
      "concepts": [
        "Mentoring junior pilots",
        "Staying sharp"
      ],
      "demonstration_criteria": "Can design a mentoring program for junior engineers that focuses on developing skills in code review, system-level thinking, and hypothesis-driven debugging, outlining specific exercises and assessment methods."
    },
    {
      "id": "claim-4",
      "statement": "Maintaining coding skills is crucial for software pilots to effectively evaluate agent-generated code and stay current with industry best practices.",
      "concepts": [
        "Staying sharp",
        "Why the shift is hard"
      ],
      "demonstration_criteria": "Can create a personal plan for maintaining coding proficiency, including specific activities like contributing to open-source projects, debugging production issues, and participating in code reviews, with measurable goals for each activity."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Writing code is always the most efficient way to solve a problem.",
      "correction": "In many cases, delegating code generation to an AI agent and then evaluating the result is faster and more effective than writing the code directly, especially for routine tasks.",
      "related_claims": [
        "claim-1",
        "claim-2"
      ]
    },
    {
      "id": "misconception-2",
      "belief": "If AI agents are writing code, my coding skills are no longer important.",
      "correction": "Your coding skills are essential for evaluating the quality and correctness of agent-generated code, debugging complex issues, and knowing when to intervene and write the code yourself.",
      "related_claims": [
        "claim-3",
        "claim-4"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "The shift from 'coder' to 'pilot' is about leveraging automation to amplify your impact, not replacing your skills.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Effective software pilotry requires a balance between delegating tasks to AI and taking direct control when necessary.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "The ability to critically evaluate code and systems becomes even more important when AI agents are involved.",
      "order": 3
    }
  ]
};
