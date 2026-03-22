import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "6.1",
  "generated_at": "2024-10-27T14:32:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [
    "Module 1, section 1.3",
    "Module 2, section 2.3",
    "Module 3, section 3.2",
    "Module 3, section 3.4"
  ],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "Organizations must establish a security review process specifically targeting agent-generated code to identify unique vulnerabilities.",
      "concepts": [
        "Security Audit Commission",
        "Agent-generated code patterns"
      ],
      "demonstration_criteria": "Can compare the findings of a general security review with a security review focused on agent-generated code and propose process changes to address the identified delta."
    },
    {
      "id": "claim-2",
      "statement": "Calculating the true ROI of agent-assisted development requires accounting for all associated costs, including generation, specification, review, debugging, and incident costs.",
      "concepts": [
        "Honest ROI Calculation",
        "Agent-assisted development"
      ],
      "demonstration_criteria": "Can construct an ROI calculation for agent-assisted development that includes generation, specification, review, integration, debugging, and incident costs, and defend the calculation against scrutiny from both engineering and finance perspectives."
    },
    {
      "id": "claim-3",
      "statement": "A pilotry maturity assessment helps organizations identify high-leverage investments to advance their agent-assisted development capabilities.",
      "concepts": [
        "Maturity Assessment",
        "Pilotry maturity model"
      ],
      "demonstration_criteria": "Can evaluate an organization's current state against a pilotry maturity model, identify the single highest-leverage investment to reach the next level, and justify the recommendation with specific cost estimates."
    },
    {
      "id": "claim-4",
      "statement": "Incentive structures must be redesigned to reward engineers for verification rigor, specification quality, and agent error detection, not just traditional throughput.",
      "concepts": [
        "Incentive Redesign",
        "Verification rigor",
        "Specification quality",
        "Agent error detection"
      ],
      "demonstration_criteria": "Can propose revised performance review criteria and team metrics that incentivize engineers to prioritize verification rigor, specification quality, and agent error detection alongside traditional throughput metrics."
    },
    {
      "id": "claim-5",
      "statement": "Post-incident reviews for agent-generated code failures should focus on systemic improvements to the specification-verification pipeline, rather than individual blame.",
      "concepts": [
        "Incident Response Protocol",
        "Specification gap",
        "Verification adequacy"
      ],
      "demonstration_criteria": "Can conduct a post-incident review for an agent-generated code failure, using agent-specific questions (specification gap vs. agent deviation, verification adequacy, novel failure class), and identify systemic improvements to the specification-verification pipeline."
    },
    {
      "id": "claim-6",
      "statement": "A well-designed agent-assisted workflow encompasses specification review, risk classification, delegation protocols, verification pipeline, and escalation paths.",
      "concepts": [
        "Workflow Design",
        "Specification review",
        "Risk classification",
        "Delegation protocols",
        "Verification pipeline",
        "Escalation paths"
      ],
      "demonstration_criteria": "Can design a complete agent-assisted workflow, including specification review, risk classification, delegation protocols, verification pipeline, and escalation paths, and refine the workflow based on testing and feedback from engineering leads."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "General security reviews are sufficient for identifying vulnerabilities in agent-generated code.",
      "correction": "Agent-generated code introduces unique vulnerabilities that require specialized security review processes.",
      "related_claims": [
        "claim-1"
      ]
    },
    {
      "id": "misconception-2",
      "belief": "ROI calculations for agent-assisted development only need to consider code generation speed.",
      "correction": "A true ROI calculation must include all costs associated with agent-assisted development, including specification, review, debugging, and incident costs.",
      "related_claims": [
        "claim-2"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Senior leaders must ensure that organizational processes are adapted to effectively manage the risks and opportunities presented by agent-assisted development.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Simulation exercises allow organizations to proactively identify and address potential weaknesses in their agent-assisted development systems.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Readiness markers provide a concrete framework for evaluating an organization's preparedness for scaling agent-assisted development.",
      "order": 3
    }
  ]
};
