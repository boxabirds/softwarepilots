import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "2.2",
  "generated_at": "2024-07-10T10:30:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "Engineers can evaluate whether to build, buy, or configure an AI agent based on specific criteria related to use case commonality, data sensitivity, integration needs, and internal resources.",
      "concepts": [
        "Build vs. buy vs. configure"
      ],
      "demonstration_criteria": "Given a scenario describing a software project with specific requirements (e.g., handling sensitive data, integrating with legacy systems), the engineer can justify whether to use an off-the-shelf agent, configure an existing agent, or build a custom agent, explaining the trade-offs of each approach."
    },
    {
      "id": "claim-2",
      "statement": "Organizations can mitigate vendor lock-in by abstracting agent interactions behind internal interfaces and maintaining agent-agnostic specifications.",
      "concepts": [
        "Vendor lock-in and model dependency"
      ],
      "demonstration_criteria": "The engineer can design an internal API that abstracts interactions with a specific AI agent, allowing for easier switching to a different agent in the future. The engineer can also create a specification document that describes the desired behavior of the agent without being tied to a specific agent's API."
    },
    {
      "id": "claim-3",
      "statement": "Data governance policies must address the potential for sensitive data exposure when using AI agents, specifying what data can be sent to third parties and how to handle sensitive information.",
      "concepts": [
        "Data governance"
      ],
      "demonstration_criteria": "Given a data governance policy, the engineer can identify which types of data (e.g., source code, API keys, customer data) require redaction or special handling before being used with an AI agent. The engineer can also propose modifications to the data governance policy to address the risks associated with using AI agents."
    },
    {
      "id": "claim-4",
      "statement": "Configuration of off-the-shelf agents is often the most practical starting point for organizations adopting AI tooling.",
      "concepts": [
        "Build vs. buy vs. configure"
      ],
      "demonstration_criteria": "The engineer can outline the steps required to configure an off-the-shelf agent for a specific task, such as using system prompts and RAG to tailor the agent's behavior to internal documentation, and explain why this approach is preferable to building a custom agent from scratch in many cases."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Building internal AI tooling is always the best option for maintaining control over data and ensuring optimal performance.",
      "correction": "Building internal AI tooling requires significant ML engineering talent and ongoing investment. Configuring off-the-shelf agents is often a more practical starting point, especially when use cases are common and data sensitivity is not a primary concern.",
      "related_claims": [
        "claim-1"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Choosing the right approach (build, buy, configure) requires a careful evaluation of your specific needs and resources.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Vendor lock-in can be mitigated through careful design and abstraction.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Data governance is crucial to ensure responsible and secure use of AI agents.",
      "order": 3
    }
  ]
};
