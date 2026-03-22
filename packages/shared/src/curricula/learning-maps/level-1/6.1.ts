import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "6.1",
  "generated_at": "2024-10-27T14:35:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "A 'False Green Test Suite' can provide a false sense of security if it doesn't cover concurrency, resource management, and boundary conditions.",
      "concepts": [
        "S1.1 - The False Green Test Suite"
      ],
      "demonstration_criteria": "Can identify at least three distinct bugs related to concurrency, resource management, or boundary conditions that are missed by a given passing test suite."
    },
    {
      "id": "claim-2",
      "statement": "Tracing user actions end-to-end through a system helps identify potential failure modes at each system boundary.",
      "concepts": [
        "S1.2 - End-to-End Trace"
      ],
      "demonstration_criteria": "Can map a user request through at least five system components and identify at least two potential failure modes at each boundary, including network latency, data corruption, and service unavailability."
    },
    {
      "id": "claim-3",
      "statement": "Security reviews of agent-generated code should focus on authorization gaps, secret exposure, and input validation failures.",
      "concepts": [
        "S1.3 - Security Review"
      ],
      "demonstration_criteria": "Can identify at least one instance each of an authorization gap, secret exposure, and input validation failure in a provided agent-generated authentication code sample."
    },
    {
      "id": "claim-4",
      "statement": "Comparing code generated from vague vs. precise specifications highlights the cost of ambiguity and the importance of clear requirements.",
      "concepts": [
        "S1.4 - Specification Comparison"
      ],
      "demonstration_criteria": "Can explain the differences in behavior between code generated from a vague specification and code generated from a precise specification, and quantify the variance in outputs."
    },
    {
      "id": "claim-5",
      "statement": "Systematically identifying hallucinations, assumptions, and boundary failures in features built with vague specifications is crucial for robust software.",
      "concepts": [
        "S1.5 - Failure Mode Scavenger Hunt"
      ],
      "demonstration_criteria": "Given a feature built with a deliberately vague specification, can reliably detect at least one hallucination, one incorrect assumption, and one boundary failure during a review session."
    },
    {
      "id": "claim-6",
      "statement": "Calibrating trust in agent output by logging trust decisions and comparing them to outcomes improves judgment over time.",
      "concepts": [
        "S1.6 - Judgment Calibration"
      ],
      "demonstration_criteria": "Over a one-week period, can achieve a trust calibration accuracy exceeding 80% when predicting the trustworthiness of agent output."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Passing tests always guarantee the absence of bugs.",
      "correction": "Passing tests only guarantee that the code behaves as expected under the conditions tested. They don't necessarily cover all possible scenarios or edge cases, especially in concurrent or resource-intensive systems.",
      "related_claims": [
        "claim-1"
      ]
    },
    {
      "id": "misconception-2",
      "belief": "Security vulnerabilities are always obvious in code.",
      "correction": "Security vulnerabilities can be subtle and require careful analysis of authorization logic, data handling, and potential attack vectors.",
      "related_claims": [
        "claim-3"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Simulation readiness markers provide a structured way to assess your skills against practical scenarios.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Each marker focuses on a specific skill and provides clear criteria for determining readiness.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "Meeting the readiness criteria for each marker increases your confidence and competence in applying the learned concepts.",
      "order": 3
    }
  ]
};
