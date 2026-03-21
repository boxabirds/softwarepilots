import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATION_PATH = resolve(
  __dirname,
  "../../src/db/migrations/0001_skeleton.sql"
);

describe("submission intake integration", () => {
  let db: InstanceType<typeof Database>;

  beforeAll(() => {
    db = new Database(":memory:");
    const migration = readFileSync(MIGRATION_PATH, "utf-8");
    db.exec(migration);

    // Seed a learner
    db.prepare(
      `INSERT INTO learners (id, email, auth_provider, auth_subject)
       VALUES ('test-learner', 'test@example.com', 'github', '99999')`
    ).run();
  });

  afterAll(() => {
    db.close();
  });

  beforeEach(() => {
    db.exec("DELETE FROM submissions");
    db.exec("DELETE FROM progress");
  });

  it("inserts a submission with self-assessment and null scores", () => {
    const contentJson = JSON.stringify({ code: "print(1)", console_output: "1", modifications: [] });
    const selfAssessmentJson = JSON.stringify({
      predictions: { code_comprehension: 7, prediction_accuracy: 5 },
      weakest_dimension: "prediction_accuracy",
    });

    db.prepare(
      `INSERT INTO submissions (id, learner_id, module_id, exercise_id, content_json, self_assessment_json, rubric_version)
       VALUES ('sub-1', 'test-learner', '2', '2.1', ?, ?, 'v1')`
    ).run(contentJson, selfAssessmentJson);

    const row = db.prepare("SELECT * FROM submissions WHERE id = 'sub-1'").get() as {
      score_json: string | null;
      self_assessment_json: string;
      learner_id: string;
    };

    expect(row.learner_id).toBe("test-learner");
    expect(row.score_json).toBeNull();
    expect(JSON.parse(row.self_assessment_json)).toHaveProperty("predictions");
  });

  it("upserts progress to submitted status with attempt tracking", () => {
    // First submission
    db.prepare(
      `INSERT INTO progress (learner_id, module_id, exercise_id, status, attempts, first_submitted, last_submitted)
       VALUES ('test-learner', '2', '2.1', 'submitted', 1, datetime('now'), datetime('now'))`
    ).run();

    const first = db.prepare(
      "SELECT * FROM progress WHERE learner_id = 'test-learner' AND exercise_id = '2.1'"
    ).get() as { attempts: number; status: string };
    expect(first.status).toBe("submitted");
    expect(first.attempts).toBe(1);

    // Re-submission via upsert
    db.prepare(
      `INSERT INTO progress (learner_id, module_id, exercise_id, status, attempts, first_submitted, last_submitted)
       VALUES ('test-learner', '2', '2.1', 'submitted', 1, datetime('now'), datetime('now'))
       ON CONFLICT (learner_id, module_id, exercise_id)
       DO UPDATE SET status = 'submitted', attempts = attempts + 1, last_submitted = datetime('now')`
    ).run();

    const second = db.prepare(
      "SELECT * FROM progress WHERE learner_id = 'test-learner' AND exercise_id = '2.1'"
    ).get() as { attempts: number };
    expect(second.attempts).toBe(2);
  });

  it("submissions are append-only - re-submission creates new row", () => {
    db.prepare(
      `INSERT INTO submissions (id, learner_id, module_id, exercise_id, content_json, rubric_version)
       VALUES ('sub-a', 'test-learner', '2', '2.1', '{"code":"v1"}', 'v1')`
    ).run();

    db.prepare(
      `INSERT INTO submissions (id, learner_id, module_id, exercise_id, content_json, rubric_version)
       VALUES ('sub-b', 'test-learner', '2', '2.1', '{"code":"v2"}', 'v1')`
    ).run();

    const count = db.prepare(
      "SELECT COUNT(*) as n FROM submissions WHERE learner_id = 'test-learner'"
    ).get() as { n: number };
    expect(count.n).toBe(2);
  });

  it("scoring updates submission and progress", () => {
    db.prepare(
      `INSERT INTO submissions (id, learner_id, module_id, exercise_id, content_json, rubric_version)
       VALUES ('sub-score', 'test-learner', '2', '2.1', '{"code":"x"}', 'v1')`
    ).run();
    db.prepare(
      `INSERT INTO progress (learner_id, module_id, exercise_id, status, attempts)
       VALUES ('test-learner', '2', '2.1', 'submitted', 1)`
    ).run();

    // Simulate evaluator updating
    db.prepare(
      `UPDATE submissions SET score_json = ?, calibration_gap_json = ?, evaluator_model = ?, scored_at = datetime('now')
       WHERE id = 'sub-score'`
    ).run(
      JSON.stringify([{ key: "code_comprehension", score: 8 }]),
      JSON.stringify([{ key: "code_comprehension", gap: 1 }]),
      "test-model"
    );

    db.prepare(
      `UPDATE progress SET status = 'scored', score_json = ?
       WHERE learner_id = 'test-learner' AND module_id = '2' AND exercise_id = '2.1'`
    ).run(JSON.stringify({ overall: 8, passed: true }));

    const sub = db.prepare("SELECT * FROM submissions WHERE id = 'sub-score'").get() as {
      score_json: string;
      scored_at: string;
    };
    expect(sub.score_json).toBeTruthy();
    expect(sub.scored_at).toBeTruthy();

    const prog = db.prepare(
      "SELECT * FROM progress WHERE learner_id = 'test-learner' AND exercise_id = '2.1'"
    ).get() as { status: string; score_json: string };
    expect(prog.status).toBe("scored");
    expect(JSON.parse(prog.score_json)).toHaveProperty("passed", true);
  });

  it("only returns submissions for the correct learner", () => {
    db.prepare(
      `INSERT INTO learners (id, email, auth_provider, auth_subject)
       VALUES ('other-learner', 'other@example.com', 'github', '88888')`
    ).run();

    db.prepare(
      `INSERT INTO submissions (id, learner_id, module_id, exercise_id, content_json, rubric_version)
       VALUES ('sub-own', 'test-learner', '2', '2.1', '{}', 'v1')`
    ).run();
    db.prepare(
      `INSERT INTO submissions (id, learner_id, module_id, exercise_id, content_json, rubric_version)
       VALUES ('sub-other', 'other-learner', '2', '2.1', '{}', 'v1')`
    ).run();

    const own = db.prepare(
      "SELECT id FROM submissions WHERE learner_id = 'test-learner'"
    ).all() as Array<{ id: string }>;
    expect(own).toHaveLength(1);
    expect(own[0].id).toBe("sub-own");
  });
});
