/**
 * Unit tests for template variable resolution (Story 49).
 */

import { describe, it, expect, spyOn, afterEach } from "bun:test";
import { resolveTemplate } from "../prompts";

let warnSpy: ReturnType<typeof spyOn>;

afterEach(() => {
  warnSpy?.mockRestore();
});

describe("resolveTemplate", () => {
  it("replaces all variables when all are provided", () => {
    const template = `You are a tutor for "{{section_title}}" in {{profile}}.`;
    const result = resolveTemplate(template, {
      section_title: "Systems Vocabulary",
      profile: "level-0",
    });
    expect(result).toBe(`You are a tutor for "Systems Vocabulary" in level-0.`);
  });

  it("warns and leaves placeholder for unresolved variables", () => {
    warnSpy = spyOn(console, "warn").mockImplementation(() => {});

    const template = "Hello {{name}}, welcome to {{course}}.";
    const result = resolveTemplate(template, { name: "Julian" });

    expect(result).toBe("Hello Julian, welcome to {{course}}.");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("{{course}}");
  });

  it("returns input unchanged when no variables in template", () => {
    const template = "This is plain text with no variables.";
    const result = resolveTemplate(template, { unused: "value" });
    expect(result).toBe(template);
  });

  it("ignores extra vars not referenced in template", () => {
    const template = "Hello {{name}}.";
    const result = resolveTemplate(template, { name: "Julian", extra: "ignored" });
    expect(result).toBe("Hello Julian.");
  });

  it("returns empty string for empty template", () => {
    const result = resolveTemplate("", { name: "Julian" });
    expect(result).toBe("");
  });

  it("replaces multiple occurrences of the same variable", () => {
    const template = "{{name}} said hello. {{name}} then left.";
    const result = resolveTemplate(template, { name: "Julian" });
    expect(result).toBe("Julian said hello. Julian then left.");
  });

  it("handles dotted variable names", () => {
    const template = "Title: {{meta.title}}, ID: {{rubric.id}}";
    const result = resolveTemplate(template, {
      "meta.title": "Exercise 1",
      "rubric.id": "ex-1",
    });
    expect(result).toBe("Title: Exercise 1, ID: ex-1");
  });

  it("does not replace partial matches or malformed braces", () => {
    const template = "Not a var: {name} or {{}} or {{{name}}}";
    const result = resolveTemplate(template, { name: "Julian" });
    // {name} is not {{name}}, {{}} has empty key, {{{name}}} has extra brace
    expect(result).toContain("{name}");
    expect(result).toContain("{{}}");
  });

  it("handles template with only variables", () => {
    const result = resolveTemplate("{{a}}{{b}}", { a: "hello", b: "world" });
    expect(result).toBe("helloworld");
  });
});
