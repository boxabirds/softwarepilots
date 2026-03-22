import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "1.3",
  "generated_at": "2024-11-03T14:30:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "Developers must proactively identify potential vulnerabilities in agent-generated code, such as SQL injection and XSS, by manually reviewing the code for insecure patterns.",
      "concepts": [
        "Supply chain risk"
      ],
      "demonstration_criteria": "Given an agent-generated web application with user input, the learner can identify at least one potential SQL injection or XSS vulnerability by inspecting the code and explaining how a malicious user could exploit it."
    },
    {
      "id": "claim-2",
      "statement": "Developers should evaluate the security implications of dependencies introduced by agents, including maintenance status, known vulnerabilities, and license compatibility.",
      "concepts": [
        "Supply chain risk"
      ],
      "demonstration_criteria": "Given a list of dependencies added by an agent, the learner can use `npm audit` (or equivalent) and GitHub to assess the security risk of each dependency, reporting on the number of open security issues and the last commit date."
    },
    {
      "id": "claim-3",
      "statement": "Developers must implement authorization mechanisms to restrict user access to specific resources and functionalities, even if the agent only implements authentication.",
      "concepts": [
        "Threat modeling as a skill"
      ],
      "demonstration_criteria": "Given an agent-generated application with authentication, the learner can identify at least one endpoint that lacks proper authorization and demonstrate how an authenticated user can access resources they should not be able to access."
    },
    {
      "id": "claim-4",
      "statement": "Developers should proactively perform threat modeling to identify potential attack vectors and incorporate security considerations into agent specifications.",
      "concepts": [
        "Threat modeling as a skill"
      ],
      "demonstration_criteria": "Given a description of a new feature to be implemented by an agent, the learner can list at least three potential attack vectors and describe how the agent's implementation should defend against them."
    },
    {
      "id": "claim-5",
      "statement": "Developers must ensure that secrets, such as API keys and database passwords, are not hardcoded in the source code or committed to version control.",
      "concepts": [
        "Supply chain risk"
      ],
      "demonstration_criteria": "Given an agent-generated codebase, the learner can identify any hardcoded secrets (e.g., API keys, passwords) and explain how to securely store and manage them using environment variables or a secrets management system."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "If an agent generates code that 'works', it is also secure.",
      "correction": "Agents prioritize functionality over security, often introducing vulnerabilities that must be addressed by the developer.",
      "related_claims": [
        "claim-1",
        "claim-3"
      ]
    },
    {
      "id": "misconception-2",
      "belief": "Dependencies added by agents are automatically safe and up-to-date.",
      "correction": "Agents do not evaluate dependencies for security risks; developers must manually review them.",
      "related_claims": [
        "claim-2"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Agents optimize for functionality, not security, leading to potential vulnerabilities.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Thinking like an attacker helps identify potential weaknesses in agent-generated code.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Security is a continuous process of review and threat modeling, not a one-time fix.",
      "order": 3
    }
  ]
};
