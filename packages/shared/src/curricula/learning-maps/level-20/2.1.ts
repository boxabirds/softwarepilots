import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "2.1",
  "generated_at": "2024-11-03T14:35:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "Vendor claims about agent capabilities should be realistically adjusted downwards when considering production environments.",
      "concepts": [
        "Cutting through vendor hype"
      ],
      "demonstration_criteria": "Given a vendor's productivity claim for a coding agent, the learner can calculate a more realistic estimate for production use by dividing the vendor's claim by a factor of 3 to 5 and justify this adjustment with the increased verification overhead in production."
    },
    {
      "id": "claim-2",
      "statement": "Agent capabilities are not uniform across different tasks, programming languages, or problem domains.",
      "concepts": [
        "The \"jagged intelligence\" problem for organizations"
      ],
      "demonstration_criteria": "Given three different coding tasks (e.g., React component, cryptographic function, simple CRUD operation), the learner can predict which task an agent is most likely to perform reliably and justify their prediction based on the task's complexity and the agent's known strengths and weaknesses."
    },
    {
      "id": "claim-3",
      "statement": "Organizations need to assess agent capabilities on a per-task basis, specific to their tech stack, domain, and quality requirements.",
      "concepts": [
        "The \"jagged intelligence\" problem for organizations"
      ],
      "demonstration_criteria": "Given a description of a software engineering team's tech stack, domain, and quality requirements, the learner can design a plan to evaluate an agent's suitability for a specific task, including defining relevant benchmarks and metrics."
    },
    {
      "id": "claim-4",
      "statement": "Agent capabilities are rapidly evolving, requiring frequent re-evaluation.",
      "concepts": [
        "Rate of change"
      ],
      "demonstration_criteria": "Given a scenario where an agent's performance on a specific task has changed over time, the learner can explain the possible causes for the change (e.g., model updates, API changes) and recommend a strategy for monitoring and adapting to these changes."
    },
    {
      "id": "claim-5",
      "statement": "Software development processes should be designed to be agent-agnostic where possible, focusing on specification, delegation, and verification.",
      "concepts": [
        "Rate of change"
      ],
      "demonstration_criteria": "Given a description of a software development process, the learner can identify the steps that are agent-specific and propose modifications to make the process more agent-agnostic, emphasizing clear specifications and rigorous verification."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "If an agent performs well on coding benchmarks, it will automatically improve developer productivity in production environments.",
      "correction": "Benchmark performance is a necessary but not sufficient condition for production utility. Production environments introduce complexities like legacy code, ambiguous requirements, and integration constraints that can significantly reduce the benefits of using agents. Verification overhead also increases.",
      "related_claims": [
        "claim-1"
      ]
    },
    {
      "id": "misconception-2",
      "belief": "An agent's performance on one type of coding task is indicative of its performance on all coding tasks.",
      "correction": "Agent capabilities vary significantly across different tasks, programming languages, and problem domains. Organizations need to assess agent capabilities on a per-task basis to ensure reliability and avoid catastrophic failures.",
      "related_claims": [
        "claim-2",
        "claim-3"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Agent capabilities are often overhyped by vendors, requiring a critical and realistic assessment of their actual performance in production environments.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Agents exhibit 'jagged intelligence,' excelling in some areas while failing in others, necessitating task-specific evaluation and deployment strategies.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "The rapid pace of change in agent capabilities demands continuous monitoring and adaptation of development processes.",
      "order": 3
    }
  ]
};
