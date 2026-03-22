import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "1.1",
  "generated_at": "2024-10-27T14:32:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "Agent-generated code can introduce systemic vulnerabilities due to correlated failures arising from the agent's consistent error patterns.",
      "concepts": [
        "Confident incorrectness at scale"
      ],
      "demonstration_criteria": "Can diagnose a scenario where an agent introduces the same vulnerability across multiple modules and explain why traditional QA processes might fail to detect it."
    },
    {
      "id": "claim-2",
      "statement": "Organizations must establish clear accountability frameworks for agent-generated code to address liability concerns in case of data breaches or other incidents.",
      "concepts": [
        "Liability and accountability"
      ],
      "demonstration_criteria": "Can outline a policy that defines the roles and responsibilities of developers, reviewers, tech leads, and directors concerning agent-generated code, including documentation requirements for audit trails."
    },
    {
      "id": "claim-3",
      "statement": "Using agents to generate code in regulated industries requires careful consideration of compliance requirements related to code review, testing, and data handling.",
      "concepts": [
        "Regulatory implications"
      ],
      "demonstration_criteria": "Can analyze a hypothetical software development scenario in a regulated industry (e.g., healthcare, finance) and identify potential compliance issues related to the use of agent-generated code, proposing solutions to address these issues."
    },
    {
      "id": "claim-4",
      "statement": "A concrete scenario of SQL injection vulnerability in the ORDER BY clause demonstrates how an agent can consistently make the same mistake across multiple API endpoints.",
      "concepts": [
        "Concrete scenario",
        "Confident incorrectness at scale"
      ],
      "demonstration_criteria": "Can identify the root cause of the SQL injection vulnerability in the ORDER BY clause example and explain how the agent's training data contributes to this consistent error."
    },
    {
      "id": "claim-5",
      "statement": "Organizations need to proactively address the liability question associated with shipping agent-generated code to production.",
      "concepts": [
        "Liability and accountability"
      ],
      "demonstration_criteria": "Can propose a plan to assess and mitigate the legal risks associated with deploying agent-generated code, including insurance and legal review of agent usage practices."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Existing quality assurance processes are sufficient to catch all bugs in agent-generated code.",
      "correction": "Traditional QA processes are designed for independent human errors and may be blind to systemic agent errors, requiring new approaches to detect correlated failures.",
      "related_claims": [
        "claim-1"
      ]
    },
    {
      "id": "misconception-2",
      "belief": "The developer who delegates to the agent is solely responsible for any issues in the generated code.",
      "correction": "Accountability should be distributed across multiple levels (developer, reviewer, tech lead, director) based on a clear policy and documented audit trail.",
      "related_claims": [
        "claim-2"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Agent-generated code introduces a new risk category: correlated failure from a shared probabilistic source.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Liability for agent-generated code requires a clear organizational policy and audit trail.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Regulatory compliance requires careful consideration of how agent-generated code aligns with existing standards.",
      "order": 3
    }
  ]
};
