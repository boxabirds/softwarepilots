import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "3.4",
  "generated_at": "2024-07-03T17:22:30Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "Organizations should implement mandatory pilotry training programs for individuals delegating tasks to agents to ensure safety and responsible AI usage.",
      "concepts": [
        "Building internal pilotry training programs",
        "Mandatory vs. optional"
      ],
      "demonstration_criteria": "Can explain why pilotry training should be mandatory by comparing it to safety training for other critical systems, such as deployment pipelines."
    },
    {
      "id": "claim-2",
      "statement": "Cohort-based learning is more effective than self-paced learning for pilotry training, especially for developing judgment skills, due to the value of shared experiences and collaborative problem-solving.",
      "concepts": [
        "Cohort-based vs. self-paced"
      ],
      "demonstration_criteria": "Can compare and contrast the benefits of cohort-based vs. self-paced learning in the context of pilotry training, highlighting the importance of shared experiences in identifying agent failure modes."
    },
    {
      "id": "claim-3",
      "statement": "A combination of internal and external instructors provides the most effective pilotry training, leveraging external expertise for conceptual frameworks and internal experience for practical application within the organization's specific context.",
      "concepts": [
        "Internal vs. external instructors"
      ],
      "demonstration_criteria": "Can design a pilotry training program that effectively integrates both external instructors (providing conceptual frameworks) and internal instructors (grounding the training in the organization's specific codebase and agent failure modes)."
    },
    {
      "id": "claim-4",
      "statement": "Organizations should establish a quarterly review cycle to reassess agent capabilities, update trust calibration guidelines, share new failure patterns, and adjust verification processes due to the rapid evolution of agent technology.",
      "concepts": [
        "Continuous learning - the quarterly cadence"
      ],
      "demonstration_criteria": "Can create a quarterly review process for pilotry training that includes reassessing agent capabilities, updating trust calibration guidelines, sharing new failure patterns, and adjusting verification processes."
    },
    {
      "id": "claim-5",
      "statement": "Creating a community of practice allows pilots to share agent failures, specification patterns, task type improvements/degradations, and open questions, fostering collective intelligence and a sustainable competitive advantage.",
      "concepts": [
        "Community of practice"
      ],
      "demonstration_criteria": "Can design a forum (e.g., Slack channel, meeting) for pilots to share agent failures, specification patterns, task type improvements/degradations, and open questions, and explain how this fosters collective intelligence."
    },
    {
      "id": "claim-6",
      "statement": "Organizations should strategically position their responsible AI-assisted development practices to attract talent, build customer trust, establish industry leadership, and prepare for future regulations.",
      "concepts": [
        "External positioning"
      ],
      "demonstration_criteria": "Can explain how an organization's pilotry practices can be used to attract engineers, build customer trust, establish industry leadership, and prepare for regulatory scrutiny."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Pilotry training is optional enrichment for engineers.",
      "correction": "Pilotry training is essential safety training for anyone delegating tasks to agents, similar to understanding deployment pipelines before deploying to production.",
      "related_claims": [
        "claim-1"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Pilotry programs are essential for mitigating risks associated with AI agents.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Continuous learning and adaptation are crucial due to the rapid evolution of AI agent capabilities.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Building a community of practice fosters collective intelligence and a sustainable competitive advantage.",
      "order": 3
    }
  ]
};
