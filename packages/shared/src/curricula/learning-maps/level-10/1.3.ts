import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "1.3",
  "generated_at": "2024-07-18T16:23:57Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "Agents can introduce unintended consequences when modifying code they don't fully understand due to implicit knowledge gaps.",
      "concepts": [
        "The danger of agents \"improving\" code they don't understand",
        "Implicit knowledge inventory"
      ],
      "demonstration_criteria": "Can diagnose a scenario where an agent's seemingly beneficial code change introduces a bug due to a lack of understanding of implicit knowledge within a legacy system."
    },
    {
      "id": "claim-2",
      "statement": "Creating an implicit knowledge inventory is crucial for guiding agents and preventing unintended consequences when working with legacy systems.",
      "concepts": [
        "Implicit knowledge inventory"
      ],
      "demonstration_criteria": "Can create an inventory of at least five implicit knowledge points for a given legacy module, including undocumented quirks, dependency issues, edge cases, timing constraints and data invariants."
    },
    {
      "id": "claim-3",
      "statement": "The Strangle Fig pattern allows for incremental modernization by gradually replacing legacy components with agent-built components behind a feature flag.",
      "concepts": [
        "Strangle fig pattern with agent labor",
        "Strategies for incremental agent-assisted modernization"
      ],
      "demonstration_criteria": "Can describe how to implement the Strangle Fig pattern to introduce a new feature using an agent, including the use of feature flags and gradual switchover."
    },
    {
      "id": "claim-4",
      "statement": "Characterization tests are essential for capturing the existing behavior of legacy code, including quirks, before an agent modifies it.",
      "concepts": [
        "Characterization tests first"
      ],
      "demonstration_criteria": "Given a snippet of legacy code, can write characterization tests that capture its current behavior, including edge cases and potential quirks."
    },
    {
      "id": "claim-5",
      "statement": "Breaking down agent-assisted modernization into small, verifiable increments minimizes risk and simplifies debugging.",
      "concepts": [
        "Small, verifiable increments",
        "Strategies for incremental agent-assisted modernization"
      ],
      "demonstration_criteria": "Can decompose a large modernization task into a series of smaller, independent changes that can be individually verified after being implemented by an agent."
    },
    {
      "id": "claim-6",
      "statement": "Reviewing every line of code changed by an agent is crucial, even if the change appears unrelated to the original request, due to the risk of unintended refactoring.",
      "concepts": [
        "The danger of agents \"improving\" code they don't understand"
      ],
      "demonstration_criteria": "Given a code diff produced by an agent, can identify potentially problematic changes that are unrelated to the original task and explain why they might be risky."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Agents can safely refactor legacy code without understanding its full context.",
      "correction": "Agents often lack the implicit knowledge required to safely refactor legacy code, potentially introducing bugs or breaking existing functionality. Always review agent changes carefully.",
      "related_claims": [
        "claim-1",
        "claim-6"
      ]
    },
    {
      "id": "misconception-2",
      "belief": "Characterization tests are unnecessary if the agent is only adding new functionality.",
      "correction": "Characterization tests are crucial for ensuring that new functionality doesn't inadvertently break existing behavior, especially in legacy systems with undocumented quirks.",
      "related_claims": [
        "claim-4"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Legacy codebases contain undocumented knowledge and workarounds that agents cannot automatically infer.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Agents, trained on general datasets, may introduce changes that break existing functionality due to a lack of context.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Incremental modernization with thorough testing and review is essential for safely integrating agent-assisted changes into legacy systems.",
      "order": 3
    }
  ]
};
