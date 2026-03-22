import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "0.1",
  "generated_at": "2024-10-27T14:32:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "Software runs on servers, which can be physical or virtualized, and understanding their limitations is crucial for evaluating agent-generated code.",
      "concepts": [
        "Virtual servers and containers"
      ],
      "demonstration_criteria": "Can explain the difference between a physical server, a virtual machine, and a container, and can identify at least three potential server-related limitations (e.g., memory constraints, network latency) that an agent might overlook in generated code."
    },
    {
      "id": "claim-2",
      "statement": "Databases store data in structured or unstructured formats, and understanding database concepts like schema, transactions, and indexes is essential for evaluating data persistence and query performance in agent-generated applications.",
      "concepts": [
        "Relational databases (SQL)",
        "Schema",
        "Transactions",
        "Indexes",
        "Non-relational databases (NoSQL)"
      ],
      "demonstration_criteria": "Can diagnose a slow query in agent-generated SQL code by identifying the absence of a necessary index, and can propose an appropriate index to improve performance. Can also explain how transactions ensure data consistency in critical operations like money transfers."
    },
    {
      "id": "claim-3",
      "statement": "APIs define contracts between software components, and understanding REST API principles is crucial for identifying potential integration issues and security vulnerabilities in agent-generated API code.",
      "concepts": [
        "REST APIs",
        "Why APIs matter for pilotry"
      ],
      "demonstration_criteria": "Given an agent-generated API endpoint, can identify potential vulnerabilities related to missing authentication, improper input validation, or incorrect HTTP method usage. Can also explain how the API contract ensures interoperability between different software components."
    },
    {
      "id": "claim-4",
      "statement": "Deployment pipelines automate the process of getting code to production, and understanding concepts like CI/CD, infrastructure as code, and environment variables is crucial for ensuring reliable and reproducible deployments of agent-generated applications.",
      "concepts": [
        "The deployment pipeline",
        "Infrastructure as code",
        "CI/CD",
        "Environment variables",
        "Rollback"
      ],
      "demonstration_criteria": "Can describe the steps in a typical CI/CD pipeline, and can explain how infrastructure as code enables reproducible deployments. Can also identify the purpose of environment variables and explain how they are used to configure applications for different environments. Can also describe the rollback process and its importance."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Servers are infinitely scalable and have no resource limitations.",
      "correction": "Servers have finite resources (CPU, memory, network bandwidth) that must be considered when designing and deploying applications. Ignoring these limitations can lead to performance bottlenecks and application failures.",
      "related_claims": [
        "claim-1"
      ]
    },
    {
      "id": "misconception-2",
      "belief": "Databases automatically optimize query performance, so developers don't need to worry about indexes.",
      "correction": "Databases require explicit indexes to optimize query performance. Without indexes, queries can become slow and inefficient, especially on large datasets.",
      "related_claims": [
        "claim-2"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Naming concepts allows you to reason about them systematically.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Understanding the underlying systems allows you to anticipate potential failure modes in agent-generated code.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Oversight requires a mental model of how software operates in its environment.",
      "order": 3
    }
  ]
};
