import { describe, it, expect } from "bun:test";
import { buildNarrativePrompt } from "../narrative";
import type { ProgressStats, SectionProgressData } from "../narrative";

/* ---- Test fixtures ---- */

const EMPTY_STATS: ProgressStats = {
  completed: 0,
  in_progress: 0,
  paused: 0,
  not_started: 10,
  total: 10,
};

const MIXED_STATS: ProgressStats = {
  completed: 3,
  in_progress: 2,
  paused: 1,
  not_started: 4,
  total: 10,
};

const SAMPLE_SECTIONS: SectionProgressData[] = [
  {
    section_id: "1.1",
    title: "Intro to Concurrency",
    status: "completed",
    understanding_level: "solid",
    concepts: {
      "thread safety": { level: "strong", review_count: 3 },
      "deadlocks": { level: "solid", review_count: 2 },
    },
  },
  {
    section_id: "1.2",
    title: "Memory Models",
    status: "in_progress",
    understanding_level: "emerging",
    concepts: {
      "cache coherence": { level: "emerging", review_count: 1 },
    },
  },
  {
    section_id: "2.1",
    title: "Distributed Systems",
    status: "not_started",
    concepts: {},
  },
];

const TEST_INSTRUCTIONS = [
  "You are a learning coach summarizing a student's curriculum progress.",
  "Write a brief, encouraging 2-3 sentence narrative summary of their progress.",
  "Be specific about what they've accomplished and what's ahead.",
  "Do not use bullet points or headers. Just plain prose.",
].join("\n");

/* ---- Tests ---- */

describe("buildNarrativePrompt", () => {
  it("includes completion stats", () => {
    const prompt = buildNarrativePrompt(SAMPLE_SECTIONS, MIXED_STATS, 2, TEST_INSTRUCTIONS);

    expect(prompt).toContain("Completed sections: 3 of 10");
    expect(prompt).toContain("In progress: 2");
    expect(prompt).toContain("Not started: 4");
  });

  it("includes concepts due for review count", () => {
    const prompt = buildNarrativePrompt(SAMPLE_SECTIONS, MIXED_STATS, 5, TEST_INSTRUCTIONS);

    expect(prompt).toContain("Concepts due for review: 5");
  });

  it("includes strongest areas from completed sections", () => {
    const prompt = buildNarrativePrompt(SAMPLE_SECTIONS, MIXED_STATS, 0, TEST_INSTRUCTIONS);

    expect(prompt).toContain("Strongest areas:");
    expect(prompt).toContain("thread safety");
    expect(prompt).toContain("deadlocks");
  });

  it("includes struggle areas from in-progress sections", () => {
    const prompt = buildNarrativePrompt(SAMPLE_SECTIONS, MIXED_STATS, 0, TEST_INSTRUCTIONS);

    expect(prompt).toContain("Areas needing work:");
    expect(prompt).toContain("cache coherence");
  });

  it("includes paused count when paused > 0", () => {
    const prompt = buildNarrativePrompt(SAMPLE_SECTIONS, MIXED_STATS, 0, TEST_INSTRUCTIONS);

    expect(prompt).toContain("Paused: 1");
  });

  it("omits paused line when paused is 0", () => {
    const statsNoPaused: ProgressStats = { ...MIXED_STATS, paused: 0 };
    const prompt = buildNarrativePrompt(SAMPLE_SECTIONS, statsNoPaused, 0, TEST_INSTRUCTIONS);

    expect(prompt).not.toContain("Paused:");
  });

  it("handles empty progress gracefully", () => {
    const prompt = buildNarrativePrompt([], EMPTY_STATS, 0, TEST_INSTRUCTIONS);

    expect(prompt).toContain("Completed sections: 0 of 10");
    expect(prompt).toContain("In progress: 0");
    expect(prompt).toContain("Not started: 10");
    // Should not contain strongest/struggling areas
    expect(prompt).not.toContain("Strongest areas:");
    expect(prompt).not.toContain("Areas needing work:");
  });

  it("handles sections with no concepts", () => {
    const noConceptSections: SectionProgressData[] = [
      {
        section_id: "1.1",
        title: "Basics",
        status: "completed",
        concepts: {},
      },
    ];
    const stats: ProgressStats = {
      completed: 1,
      in_progress: 0,
      paused: 0,
      not_started: 0,
      total: 1,
    };

    const prompt = buildNarrativePrompt(noConceptSections, stats, 0, TEST_INSTRUCTIONS);

    expect(prompt).toContain("Completed sections: 1 of 1");
    expect(prompt).not.toContain("Strongest areas:");
  });
});
