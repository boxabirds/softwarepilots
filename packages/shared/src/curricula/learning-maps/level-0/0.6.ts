import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "0.6",
  "generated_at": "2024-08-22T17:22:30Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "Proficiency in Systems Vocabulary Simulation is demonstrated by tracing user requests and predicting failure propagation in multi-component systems.",
      "concepts": [
        "S0.1 - Systems Vocabulary Simulation"
      ],
      "demonstration_criteria": "Can trace a request through 5+ components of a system diagram without reference material and accurately predict the impact of failures within those components."
    },
    {
      "id": "claim-2",
      "statement": "Readiness for Log Diagnosis Simulation is shown by identifying the root cause and secondary failures from log excerpts within a specific timeframe.",
      "concepts": [
        "S0.2 - Log Diagnosis Simulation"
      ],
      "demonstration_criteria": "Given a 200-line log excerpt from a production incident, can distinguish primary failures from secondary symptoms and formulate a correct root cause hypothesis within 10 minutes."
    },
    {
      "id": "claim-3",
      "statement": "Dashboard Triage Simulation readiness is achieved by quickly detecting incidents on live-updating dashboards and proposing relevant investigation steps.",
      "concepts": [
        "S0.3 - Dashboard Triage Simulation"
      ],
      "demonstration_criteria": "Given a simulated live-updating dashboard, can detect the onset of an incident within 2 minutes and propose investigation steps that are on the correct path to identifying the issue."
    },
    {
      "id": "claim-4",
      "statement": "Diagnostic Reasoning Simulation proficiency involves applying the observe-hypothesize-test-act-verify loop to diagnose issues in a broken web application.",
      "concepts": [
        "S0.4 - Diagnostic Reasoning Simulation"
      ],
      "demonstration_criteria": "Given a broken web application and access to logs, dashboards, and source code, can follow the diagnostic loop without skipping steps and reach the correct diagnosis within 20 minutes without external assistance."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Simulation readiness is about knowing the theory, not about practical application.",
      "correction": "Simulation readiness markers are designed to test your ability to apply theoretical knowledge to solve practical problems in simulated environments. The demonstration criteria emphasize hands-on diagnosis and troubleshooting.",
      "related_claims": [
        "claim-1",
        "claim-2",
        "claim-3",
        "claim-4"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Simulation readiness markers provide concrete, measurable goals for each simulation exercise.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Each marker outlines specific prerequisites that must be met before attempting the simulation.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "The readiness threshold defines the level of performance expected to demonstrate mastery of the material.",
      "order": 3
    }
  ]
};
