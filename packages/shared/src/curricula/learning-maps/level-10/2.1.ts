import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "2.1",
  "generated_at": "2024-01-03T16:23:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "Multi-agent workflows in software development mirror real-world patterns like the research-implement-review triangle, improving output quality by separating concerns.",
      "concepts": [
        "Multi-agent workflows - the real patterns"
      ],
      "demonstration_criteria": "Can explain how the 'research-implement-review' workflow reduces cognitive load compared to a single agent performing all tasks, and can identify scenarios where this workflow would be most beneficial."
    },
    {
      "id": "claim-2",
      "statement": "The specification-implementation-test pipeline ensures unbiased testing by having a separate agent generate tests based solely on the specification, preventing sycophantic testing.",
      "concepts": [
        "Multi-agent workflows - the real patterns"
      ],
      "demonstration_criteria": "Can design a specification-implementation-test pipeline for a given feature and justify why the test-writing agent should not have access to the implementation during test creation."
    },
    {
      "id": "claim-3",
      "statement": "Multi-agent workflows can fail when interfaces between agents are ambiguous, outputs are in the wrong format, orchestration is poor, or the task requires holistic understanding.",
      "concepts": [
        "Multi-agent workflows - the real patterns"
      ],
      "demonstration_criteria": "Can diagnose the root cause of a failing multi-agent workflow by identifying issues such as ambiguous interfaces, incorrect output formats, lack of verification, or inappropriate task decomposition."
    },
    {
      "id": "claim-4",
      "statement": "The 'macro actions' paradigm shifts the focus from implementing individual functions to specifying and verifying entire features, enabling delegation to agents.",
      "concepts": [
        "The \"macro actions\" paradigm"
      ],
      "demonstration_criteria": "Given a user story, can decompose it into macro actions suitable for delegation to an agent, including clear specifications and verification criteria for each action."
    },
    {
      "id": "claim-5",
      "statement": "Mastery in software pilotry involves thinking in macro actions, delegating entire features instead of individual functions, and focusing on specification and verification at the feature scale.",
      "concepts": [
        "The \"macro actions\" paradigm"
      ],
      "demonstration_criteria": "Can refactor a set of micro-tasks (e.g., writing individual functions) into a macro action specification that encompasses the entire feature, including input validation, error handling, and testing requirements."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Multi-agent workflows always improve efficiency, regardless of task complexity or interface clarity.",
      "correction": "Multi-agent workflows are only effective when the task can be clearly decomposed, interfaces between agents are well-defined, and intermediate outputs are verified. Otherwise, they can introduce more overhead and errors.",
      "related_claims": [
        "claim-3"
      ]
    },
    {
      "id": "misconception-2",
      "belief": "The test-writing agent should have access to the implementation to write more comprehensive tests.",
      "correction": "Providing the test-writing agent with the implementation leads to biased tests that primarily validate what the code *does* rather than what it *should* do according to the specification. Independent test generation is crucial for unbiased verification.",
      "related_claims": [
        "claim-2"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Decomposing the development process into distinct agent roles (research, implementation, review, testing) reduces cognitive load and improves focus for each agent.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Thinking in 'macro actions' allows you to delegate entire features to agents, shifting your role from implementation to specification and verification.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Clear specifications and verification criteria are essential for successful multi-agent workflows, ensuring that agents produce the desired outputs and preventing the propagation of errors.",
      "order": 3
    }
  ]
};
