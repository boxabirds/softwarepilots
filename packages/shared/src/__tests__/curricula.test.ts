import { describe, it, expect } from "vitest";
import {
  getCurriculumProfiles,
  getCurriculumMeta,
  getCurriculumSections,
  getSection,
} from "../curricula";
import type { LearnerProfile } from "../curricula";

const ALL_PROFILES: LearnerProfile[] = ["new-grad", "veteran", "senior-leader"];
const MODULES_PER_PROFILE = 3;

const EXPECTED_SECTION_COUNTS: Record<LearnerProfile, number> = {
  "new-grad": 10,
  veteran: 10,
  "senior-leader": 10,
};

describe("getCurriculumProfiles", () => {
  it("returns all three profiles with counts", () => {
    const profiles = getCurriculumProfiles();
    expect(profiles).toHaveLength(ALL_PROFILES.length);

    for (const p of profiles) {
      expect(ALL_PROFILES).toContain(p.profile);
      expect(p.title).toBeTruthy();
      expect(p.starting_position).toBeTruthy();
      expect(p.module_count).toBe(MODULES_PER_PROFILE);
      expect(p.section_count).toBeGreaterThan(0);
    }
  });
});

describe("getCurriculumMeta", () => {
  it.each(ALL_PROFILES)("returns valid metadata for %s", (profile) => {
    const meta = getCurriculumMeta(profile);
    expect(meta.profile).toBe(profile);
    expect(meta.title).toBeTruthy();
    expect(meta.starting_position).toBeTruthy();
  });

  it("tutor_guidance is non-empty for all profiles", () => {
    for (const profile of ALL_PROFILES) {
      const meta = getCurriculumMeta(profile);
      expect(meta.tutor_guidance.length).toBeGreaterThan(0);
    }
  });

  it("throws for unknown profile", () => {
    expect(() => getCurriculumMeta("time-traveler")).toThrow(
      /Unknown learner profile/,
    );
  });
});

describe("getCurriculumSections", () => {
  it.each(ALL_PROFILES)("%s has 3 modules", (profile) => {
    const sections = getCurriculumSections(profile);
    const moduleIds = new Set(sections.map((s) => s.module_id));
    expect(moduleIds.size).toBe(MODULES_PER_PROFILE);
  });

  it.each(ALL_PROFILES)(
    "%s has expected number of sections",
    (profile) => {
      const sections = getCurriculumSections(profile);
      expect(sections).toHaveLength(EXPECTED_SECTION_COUNTS[profile]);
    },
  );

  it("sections returned without markdown (listing mode)", () => {
    const sections = getCurriculumSections("new-grad");
    for (const s of sections) {
      expect(s).not.toHaveProperty("markdown");
      expect(s.id).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(s.module_id).toBeTruthy();
      expect(s.module_title).toBeTruthy();
    }
  });
});

describe("getSection", () => {
  it("returns markdown content for valid (profile, sectionId)", () => {
    const section = getSection("new-grad", "1.1");
    expect(section.id).toBe("1.1");
    expect(section.markdown).toBeTruthy();
    expect(section.markdown.length).toBeGreaterThan(100);
    expect(section.title).toBe("How Software Actually Breaks");
    expect(section.module_id).toBe("1");
  });

  it("throws for unknown section", () => {
    expect(() => getSection("new-grad", "99.99")).toThrow(
      /Unknown section/,
    );
  });

  it("throws for unknown profile in getSection", () => {
    expect(() => getSection("alien", "1.1")).toThrow(
      /Unknown learner profile/,
    );
  });

  it("every section has non-empty markdown and key_intuition", () => {
    for (const profile of ALL_PROFILES) {
      const listing = getCurriculumSections(profile);
      for (const item of listing) {
        const full = getSection(profile, item.id);
        expect(full.markdown.length).toBeGreaterThan(0);
        // key_intuition may be empty for some sections (not all have
        // a "Key intuition to develop:" paragraph), but the field must exist
        expect(typeof full.key_intuition).toBe("string");
      }
    }
  });
});
