import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "1.3",
  "generated_at": "2024-07-10T14:30:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "Agent-assisted development introduces new threat models that require adjustments to existing security programs.",
      "concepts": [
        "New threat models"
      ],
      "demonstration_criteria": "Can identify three distinct threat models introduced by agent-assisted development (prompt injection, data leakage, dependency confusion) and explain how they differ from traditional software development threats."
    },
    {
      "id": "claim-2",
      "statement": "Security review processes must be adapted to account for specific failure patterns exhibited by agent-generated code.",
      "concepts": [
        "Security review processes for agent-generated code"
      ],
      "demonstration_criteria": "Given a piece of agent-generated code, can identify at least three potential vulnerabilities related to dependency management, secret handling, authentication/authorization, unsafe string construction, or deserialization."
    },
    {
      "id": "claim-3",
      "statement": "The use of agent-generated code raises intellectual property concerns that need to be addressed by legal teams.",
      "concepts": [
        "Intellectual property implications"
      ],
      "demonstration_criteria": "Can articulate at least three key legal questions related to licensing, copyright infringement, commercial use, and IP risks associated with agent-generated code."
    },
    {
      "id": "claim-4",
      "statement": "Prompt injection via codebase can lead to malicious content influencing the agent's output.",
      "concepts": [
        "New threat models"
      ],
      "demonstration_criteria": "Can construct a code comment that, when read by an agent, causes the agent to generate vulnerable code (e.g., using MD5 for password hashing)."
    },
    {
      "id": "claim-5",
      "statement": "Data leakage through agent context can expose proprietary information to third-party services.",
      "concepts": [
        "New threat models"
      ],
      "demonstration_criteria": "Can describe a scenario where pasting proprietary code into an agent's context could result in the data being stored, logged, or used for training by the agent provider."
    },
    {
      "id": "claim-6",
      "statement": "Dependency confusion can be amplified when agents pull in dependencies based on pattern matching.",
      "concepts": [
        "New threat models"
      ],
      "demonstration_criteria": "Can create a malicious package with a name similar to a popular internal package and explain how an agent might mistakenly include it in a project."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Existing security review processes are sufficient for agent-generated code.",
      "correction": "Agent-generated code introduces new vulnerabilities and failure patterns that require specific security review processes.",
      "related_claims": [
        "claim-2"
      ]
    },
    {
      "id": "misconception-2",
      "belief": "Agent-generated code is automatically safe and secure.",
      "correction": "Agent-generated code can reproduce vulnerable patterns from training data, requiring careful security review.",
      "related_claims": [
        "claim-2",
        "claim-4"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Agent-assisted development fundamentally changes the attack surface of software applications.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Traditional security practices are not sufficient to address the unique risks introduced by agent-generated code.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Understanding the limitations and failure modes of agents is crucial for secure agent-assisted development.",
      "order": 3
    }
  ]
};
