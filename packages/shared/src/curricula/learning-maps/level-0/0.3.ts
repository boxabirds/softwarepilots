import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "0.3",
  "generated_at": "2024-11-03T14:35:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "Diagnostic reasoning requires a structured approach of observation, hypothesis generation, testing, action, and verification to effectively address system issues.",
      "concepts": [
        "Observe",
        "Hypothesize",
        "Test",
        "Act",
        "Verify",
        "Diagnostic reasoning demonstration"
      ],
      "demonstration_criteria": "Given a broken system scenario in K8sGames, the learner can document each step of the observe-hypothesize-test-act-verify loop, including the evidence gathered at each stage, and justify their actions based on that evidence."
    },
    {
      "id": "claim-2",
      "statement": "Fluency in systems vocabulary, log interpretation, dashboard reading, and API contract understanding are essential for effective observation and hypothesis generation in diagnostic reasoning.",
      "concepts": [
        "Systems vocabulary fluency",
        "Log interpretation",
        "Dashboard reading",
        "API contract understanding",
        "Observe",
        "Hypothesize"
      ],
      "demonstration_criteria": "Given a system architecture diagram and a set of production logs related to an incident, the learner can correctly identify the affected components, interpret the relevant log entries, and propose at least two plausible hypotheses for the root cause."
    },
    {
      "id": "claim-3",
      "statement": "Understanding the deployment pipeline and security concerns helps in identifying potential sources of errors and vulnerabilities during the diagnostic process.",
      "concepts": [
        "Deployment pipeline literacy",
        "Security awareness baseline",
        "Diagnostic reasoning demonstration"
      ],
      "demonstration_criteria": "Given a description of a CI/CD pipeline and a simple web application, the learner can identify at least one potential issue in the pipeline that could lead to a deployment failure and at least two security vulnerabilities in the application."
    },
    {
      "id": "claim-4",
      "statement": "Awareness of agent limitations is crucial to avoid fixation loops and to determine when human intervention is necessary.",
      "concepts": [
        "Agent limitation awareness",
        "Fixation Loops"
      ],
      "demonstration_criteria": "The learner can explain three categories of problems where agents produce unreliable output (e.g., novel situations, complex reasoning, ambiguous instructions) and describe why statistical pattern matching struggles in these scenarios."
    },
    {
      "id": "claim-5",
      "statement": "Fixation loops occur when agents repeatedly attempt to fix errors without understanding the root cause, leading to progressively worse code.",
      "concepts": [
        "Fixation Loops",
        "Diagnostic reasoning demonstration"
      ],
      "demonstration_criteria": "Given a code snippet exhibiting a fixation loop, the learner can identify the original error, explain how the agent's attempts to fix it have compounded the problem, and propose a specific correction to address the root cause."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "The fastest way to fix agent-generated code is to repeatedly ask the agent to 'fix it'.",
      "correction": "Repeatedly asking the agent to 'fix it' without providing specific information often leads to fixation loops. Diagnostic reasoning requires understanding the root cause before taking action.",
      "related_claims": [
        "claim-1",
        "claim-4",
        "claim-5"
      ]
    },
    {
      "id": "misconception-2",
      "belief": "Security is a separate concern from debugging and diagnostic reasoning.",
      "correction": "Security vulnerabilities can be the root cause of system failures. Security awareness is an integral part of diagnostic reasoning.",
      "related_claims": [
        "claim-3"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Effective problem-solving requires understanding the current state of the system through careful observation.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Generating multiple hypotheses helps avoid premature commitment to a single, potentially incorrect, explanation.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Targeted testing provides evidence to confirm or refute hypotheses, guiding the selection of appropriate actions.",
      "order": 3
    },
    {
      "id": "insight-4",
      "statement": "Verification ensures that the chosen action effectively resolves the underlying problem, preventing recurrence.",
      "order": 4
    }
  ]
};
