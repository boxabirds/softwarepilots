import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATION_PATH = resolve(
  __dirname,
  "migrations/0001_skeleton.sql"
);
const migration = readFileSync(MIGRATION_PATH, "utf-8");

describe("D1 schema migration", () => {
  it("creates the learners table", () => {
    expect(migration).toContain("CREATE TABLE learners");
  });

  it("creates the submissions table", () => {
    expect(migration).toContain("CREATE TABLE submissions");
  });

  it("creates the progress table", () => {
    expect(migration).toContain("CREATE TABLE progress");
  });

  it("uses hex randomblob IDs for learners", () => {
    expect(migration).toMatch(
      /learners[\s\S]*?id\s+TEXT\s+PRIMARY\s+KEY\s+DEFAULT\s+\(hex\(randomblob\(16\)\)\)/
    );
  });

  it("uses hex randomblob IDs for submissions", () => {
    expect(migration).toMatch(
      /submissions[\s\S]*?id\s+TEXT\s+PRIMARY\s+KEY\s+DEFAULT\s+\(hex\(randomblob\(16\)\)\)/
    );
  });

  it("uses composite primary key for progress", () => {
    expect(migration).toMatch(
      /PRIMARY\s+KEY\s+\(learner_id,\s*module_id,\s*exercise_id\)/
    );
  });

  it("enforces unique auth_provider + auth_subject", () => {
    expect(migration).toMatch(/UNIQUE\s+\(auth_provider,\s*auth_subject\)/);
  });

  it("does not use CHECK constraints", () => {
    expect(migration).not.toMatch(/CHECK\s*\(/i);
  });

  it("creates required indexes", () => {
    expect(migration).toContain("idx_progress_learner");
    expect(migration).toContain("idx_submissions_learner");
    expect(migration).toContain("idx_submissions_calibration");
  });

  it("has a partial index for calibration analysis", () => {
    expect(migration).toMatch(
      /idx_submissions_calibration[\s\S]*?WHERE\s+self_assessment_json\s+IS\s+NOT\s+NULL/
    );
  });

  it("includes self_assessment_json and calibration_gap_json columns", () => {
    expect(migration).toContain("self_assessment_json");
    expect(migration).toContain("calibration_gap_json");
  });

  it("makes content_json NOT NULL on submissions", () => {
    expect(migration).toMatch(/content_json\s+TEXT\s+NOT\s+NULL/);
  });
});
