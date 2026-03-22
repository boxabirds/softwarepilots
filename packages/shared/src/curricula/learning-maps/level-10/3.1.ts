import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "3.1",
  "generated_at": "2024-07-17T14:32:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "Agents should be decomposed along domain boundaries rather than technical layers to ensure internally consistent decision-making within each agent.",
      "concepts": [
        "Decomposition for agent boundaries"
      ],
      "demonstration_criteria": "Can explain why decomposing an e-commerce system into 'order management', 'payment processing', and 'shipping' agents is preferable to decomposing it into 'database layer', 'API layer', and 'UI layer' agents, focusing on the decision-making autonomy of each agent."
    },
    {
      "id": "claim-2",
      "statement": "Interface contracts, defined using specifications like TypeScript interfaces or OpenAPI specs, are crucial for ensuring seamless integration between agent-generated components.",
      "concepts": [
        "Interface contracts - the specification that matters most"
      ],
      "demonstration_criteria": "Can define a complete OpenAPI specification for a 'User Authentication' service, including request/response schemas, error codes, and latency requirements, demonstrating how it facilitates clear communication between the authentication service and other services that rely on it."
    },
    {
      "id": "claim-3",
      "statement": "Non-functional requirements, such as performance, observability, and resilience, must be explicitly specified to prevent agents from producing solutions that only address functional aspects.",
      "concepts": [
        "Non-functional requirements - the chronic gap",
        "Performance",
        "Observability",
        "Resilience"
      ],
      "demonstration_criteria": "Given a scenario where an agent is tasked with building a 'Product Recommendation' service, can augment the service's specification with explicit non-functional requirements for handling 1000 requests/second, logging all external API calls, and implementing a circuit breaker pattern for downstream service failures."
    },
    {
      "id": "claim-4",
      "statement": "Explicitly defining error cases and idempotency requirements in interface contracts prevents integration bugs and ensures reliable communication between services.",
      "concepts": [
        "Interface contracts - the specification that matters most"
      ],
      "demonstration_criteria": "Can design an interface contract for a 'Inventory Update' service that includes specific error codes for 'Product Not Found' and 'Insufficient Stock', and explicitly states that the service must handle duplicate update requests (idempotency) to prevent data inconsistencies."
    },
    {
      "id": "claim-5",
      "statement": "Specifying latency requirements in interface contracts ensures that the integrated system meets performance goals.",
      "concepts": [
        "Performance",
        "Interface contracts - the specification that matters most"
      ],
      "demonstration_criteria": "Given a scenario where a 'Payment Gateway' service needs to integrate with an 'Order Processing' service, can define a latency requirement of < 100ms p99 in the interface contract and explain how this requirement impacts the design choices for both services (e.g., caching, asynchronous processing)."
    },
    {
      "id": "claim-6",
      "statement": "Including observability requirements in agent specifications enables effective monitoring and diagnosis of production issues.",
      "concepts": [
        "Observability",
        "Non-functional requirements - the chronic gap"
      ],
      "demonstration_criteria": "Can modify an agent specification to include requirements for logging request/response bodies, latency, and correlation IDs for all external API calls, and emitting metrics for request count, error rate, and latency percentiles, explaining how these additions facilitate debugging and performance monitoring."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Interface contracts are only necessary for complex systems.",
      "correction": "Interface contracts are essential for any integration between agent-generated components, regardless of system complexity, to prevent integration bugs and ensure reliable communication.",
      "related_claims": [
        "claim-2"
      ]
    },
    {
      "id": "misconception-2",
      "belief": "Non-functional requirements can be addressed after the functional requirements are implemented.",
      "correction": "Non-functional requirements must be considered from the beginning of the design process, as they significantly impact the architecture and implementation of the system.",
      "related_claims": [
        "claim-3"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Breaking down systems into agent-implemented components mirrors microservice decomposition, but with a focus on preventing integration bugs rather than operational complexity.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Well-defined interface contracts act as a shared understanding between agents, reducing ambiguity and ensuring consistent behavior across components.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Explicitly stating non-functional requirements in agent specifications guides agents to produce robust and scalable solutions that meet real-world demands.",
      "order": 3
    }
  ]
};
