import { describe, it, expect } from "vitest";
import {
  extractConcepts,
  getCurriculumSections,
  getSection,
} from "../curricula";
import type { LearnerProfile } from "../curricula";

const ALL_PROFILES: LearnerProfile[] = ["level-1", "level-10", "level-20"];

const TYPICAL_MIN_CONCEPTS = 3;
const TYPICAL_MAX_CONCEPTS = 7;

describe("extractConcepts", () => {
  it("returns non-empty array for a section with bold headers", () => {
    const md = `
Some intro text.

**Concurrency - the agent's blind spot:**
Details here.

**Memory and resource management:**
More details.
`;
    const concepts = extractConcepts(md);
    expect(concepts.length).toBeGreaterThan(0);
    expect(concepts).toContain("Concurrency - the agent's blind spot");
    expect(concepts).toContain("Memory and resource management");
  });

  it("excludes entries containing 'Exercise'", () => {
    const md = `
**Good concept:**
Some text.

**Exercise - The False Green Test Suite:**
Some exercise.
`;
    const concepts = extractConcepts(md);
    expect(concepts).toContain("Good concept");
    expect(concepts.some((c) => c.includes("Exercise"))).toBe(false);
  });

  it("excludes entries containing 'Key intuition to develop'", () => {
    const md = `
**Useful concept:**
Some text.

**Key intuition to develop:**
Some intuition.
`;
    const concepts = extractConcepts(md);
    expect(concepts).toContain("Useful concept");
    expect(concepts.some((c) => c.includes("Key intuition to develop"))).toBe(
      false,
    );
  });

  it("returns empty array for markdown with no bold headers", () => {
    const md = `
# Just a heading

Some plain text without any bold-header patterns.

- A list item
- Another item
`;
    expect(extractConcepts(md)).toEqual([]);
  });

  it("deduplicates identical labels", () => {
    const md = `
**Same concept:**
First mention.

**Same concept:**
Second mention.
`;
    const concepts = extractConcepts(md);
    expect(concepts.filter((c) => c === "Same concept")).toHaveLength(1);
  });

  it("every section across all 3 profiles has a non-empty concepts array", () => {
    for (const profile of ALL_PROFILES) {
      const listing = getCurriculumSections(profile);
      for (const item of listing) {
        const section = getSection(profile, item.id);
        expect(
          section.concepts.length,
          `${profile} section ${section.id} ("${section.title}") has no concepts`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("typical section has 3-7 concepts", () => {
    let inRange = 0;
    let total = 0;
    for (const profile of ALL_PROFILES) {
      const listing = getCurriculumSections(profile);
      for (const item of listing) {
        const section = getSection(profile, item.id);
        total++;
        if (
          section.concepts.length >= TYPICAL_MIN_CONCEPTS &&
          section.concepts.length <= TYPICAL_MAX_CONCEPTS
        ) {
          inRange++;
        }
      }
    }
    // At least half of all sections should fall in the typical range
    expect(inRange / total).toBeGreaterThan(0.5);
  });
});
