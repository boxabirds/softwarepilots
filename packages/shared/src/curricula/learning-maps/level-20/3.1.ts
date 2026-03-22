import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "3.1",
  "generated_at": "2024-10-27T14:35:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "The 'software pilot' role emphasizes skills in specification writing, code review, and verification strategy design, in addition to coding ability.",
      "concepts": [
        "Defining the \"software pilot\" role"
      ],
      "demonstration_criteria": "Given a traditional software engineering job description, the learner can rewrite it to emphasize the skills required for a 'software pilot' role, including specification writing, code review, and verification strategy design."
    },
    {
      "id": "claim-2",
      "statement": "Pilotry interviews should assess a candidate's ability to identify bugs in agent-generated code, write precise specifications, and exercise sound judgment in ambiguous situations.",
      "concepts": [
        "Interview design"
      ],
      "demonstration_criteria": "The learner can design an interview question that presents a candidate with agent-generated code containing multiple bugs (obvious, subtle, structural) and a specification, and can define a rubric for evaluating the candidate's responses."
    },
    {
      "id": "claim-3",
      "statement": "A crucial aspect of the 'software pilot' role is the ability to write specifications that are precise enough for an agent to implement correctly.",
      "concepts": [
        "Defining the \"software pilot\" role",
        "Interview design"
      ],
      "demonstration_criteria": "Given a vague product requirement, the learner can write a detailed specification that addresses permissions, revocation, notification, edge cases, and other relevant considerations, demonstrating the level of detail needed for agent implementation."
    },
    {
      "id": "claim-4",
      "statement": "Successfully transitioning existing engineers to a 'software pilot' model requires acknowledging the shift in emphasis, providing training, celebrating evaluation wins, and creating a pilotry career ladder.",
      "concepts": [
        "Managing the transition for existing engineers"
      ],
      "demonstration_criteria": "The learner can outline a plan for transitioning a team of existing engineers to a 'software pilot' model, including strategies for addressing identity threats, providing training, and recognizing pilotry contributions."
    },
    {
      "id": "claim-5",
      "statement": "Resistance to the 'software pilot' model often stems from a perceived threat to engineers' identities and a concern that their coding skills are becoming less important.",
      "concepts": [
        "Managing the transition for existing engineers"
      ],
      "demonstration_criteria": "The learner can explain why engineers might resist the transition to a 'software pilot' model and suggest strategies for addressing their concerns, such as emphasizing the continued importance of their coding skills in code review and verification."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "The 'software pilot' role is less skilled or easier than traditional software development.",
      "correction": "The 'software pilot' role requires a different skillset, emphasizing judgment, specification writing, and verification expertise, which are equally valuable and challenging as traditional coding skills.",
      "related_claims": [
        "claim-1",
        "claim-4"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "The core shift is from primarily creating code to primarily ensuring the quality and correctness of code, whether human-written or agent-generated.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "This shift necessitates a change in hiring practices, performance evaluation, and career progression to value judgment, specification skills, and verification expertise.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Successfully transitioning to a 'software pilot' model requires addressing the potential identity threat to existing engineers and providing them with the necessary training and support.",
      "order": 3
    }
  ]
};
