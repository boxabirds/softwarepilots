import type { SectionLearningMap } from "../../../curricula";

export const map: SectionLearningMap = {
  "section_id": "0.2",
  "generated_at": "2024-10-27T10:30:00Z",
  "model_used": "gemini-2.0-flash",
  "prerequisites": [],
  "core_claims": [
    {
      "id": "claim-1",
      "statement": "Engineers can diagnose system behavior by identifying the timestamp, log level, message, and context within a log entry.",
      "concepts": [
        "Log anatomy",
        "Log levels and what they mean",
        "DEBUG",
        "INFO",
        "WARN",
        "ERROR",
        "FATAL/CRITICAL"
      ],
      "demonstration_criteria": "Given a log entry, the engineer can accurately identify and describe the timestamp, log level, message, and context, and explain the severity implied by the log level."
    },
    {
      "id": "claim-2",
      "statement": "Engineers can use log levels to filter and prioritize log messages, focusing on the most critical issues in a system.",
      "concepts": [
        "Log levels and what they mean",
        "DEBUG",
        "INFO",
        "WARN",
        "ERROR",
        "FATAL/CRITICAL"
      ],
      "demonstration_criteria": "Given a scenario (e.g., debugging, monitoring production), the engineer can select the appropriate log level(s) to filter logs and explain why those levels are most relevant."
    },
    {
      "id": "claim-3",
      "statement": "Engineers can interpret the four golden signals (latency, traffic, errors, saturation) to understand the overall health and performance of a service.",
      "concepts": [
        "The four golden signals",
        "Latency",
        "Traffic",
        "Errors",
        "Saturation"
      ],
      "demonstration_criteria": "Given a dashboard displaying the four golden signals, the engineer can describe the current state of the service (healthy, degraded, failing) and justify their assessment based on the signal values."
    },
    {
      "id": "claim-4",
      "statement": "Engineers can identify potential issues by recognizing patterns, timing, and correlations in log data.",
      "concepts": [
        "Log anatomy",
        "Log levels and what they mean",
        "DEBUG",
        "INFO",
        "WARN",
        "ERROR",
        "FATAL/CRITICAL"
      ],
      "demonstration_criteria": "Given a set of logs, the engineer can identify repeating errors, pinpoint the start time of an issue, and correlate errors across different services to suggest potential root causes."
    },
    {
      "id": "claim-5",
      "statement": "Engineers can diagnose performance bottlenecks by analyzing latency metrics (p50, p95, p99) on a dashboard.",
      "concepts": [
        "The four golden signals",
        "Latency",
        "Reading a dashboard"
      ],
      "demonstration_criteria": "Given a dashboard showing latency metrics (p50, p95, p99), the engineer can identify whether the system has a tail-latency problem and explain its impact on user experience."
    },
    {
      "id": "claim-6",
      "statement": "Engineers can determine resource exhaustion by observing saturation metrics (CPU, memory, disk, connection pool) on a dashboard.",
      "concepts": [
        "The four golden signals",
        "Saturation",
        "Reading a dashboard"
      ],
      "demonstration_criteria": "Given a dashboard showing saturation metrics, the engineer can identify which resources are nearing their limits and explain the potential consequences for the service."
    }
  ],
  "key_misconceptions": [
    {
      "id": "misconception-1",
      "belief": "Logs are only useful for debugging code during development.",
      "correction": "Logs provide valuable insights into system behavior in production, enabling engineers to diagnose issues, monitor performance, and understand user activity.",
      "related_claims": [
        "claim-1",
        "claim-4"
      ]
    },
    {
      "id": "misconception-2",
      "belief": "All errors are equally important and require immediate attention.",
      "correction": "Log levels allow engineers to prioritize errors based on severity, focusing on FATAL/CRITICAL errors that indicate system failures before addressing less critical WARN or ERROR messages.",
      "related_claims": [
        "claim-2"
      ]
    }
  ],
  "key_intuition_decomposition": [
    {
      "id": "insight-1",
      "statement": "Understanding system behavior requires observing the data it emits through logs and dashboards.",
      "order": 1
    },
    {
      "id": "insight-2",
      "statement": "Logs provide granular, timestamped records of events, while dashboards offer aggregated views of system health.",
      "order": 2
    },
    {
      "id": "insight-3",
      "statement": "By analyzing patterns and trends in logs and dashboards, engineers can diagnose problems and identify root causes.",
      "order": 3
    }
  ]
};
