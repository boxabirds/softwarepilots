/**
 * UI component tests for the admin Prompts tab (Story 49).
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

afterEach(() => { cleanup(); });

/* ---- Minimal PromptsTab extraction for testing ---- */

interface PromptRow {
  id: number;
  key: string;
  content: string;
  version: number;
  created_at: string;
  created_by: string | null;
  reason: string | null;
}

interface PromptListProps {
  prompts: PromptRow[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

function PromptList({ prompts, selectedKey, onSelect }: PromptListProps) {
  if (prompts.length === 0) {
    return <div data-testid="prompts-empty">No prompts found. Run the seed script to populate prompts.</div>;
  }

  return (
    <ul data-testid="prompt-list">
      {prompts.map((p) => (
        <li key={p.key}>
          <button
            onClick={() => onSelect(p.key)}
            data-testid={`prompt-key-${p.key}`}
            style={{ fontWeight: selectedKey === p.key ? "bold" : "normal" }}
          >
            <span className="key">{p.key}</span>
            <span className="preview">v{p.version} - {p.content.slice(0, 60)}...</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

interface PromptEditorProps {
  content: string;
  originalContent: string;
  reason: string;
  onContentChange: (content: string) => void;
  onReasonChange: (reason: string) => void;
  onSave: () => void;
  saving: boolean;
}

function PromptEditor({ content, originalContent, reason, onContentChange, onReasonChange, onSave, saving }: PromptEditorProps) {
  const contentChanged = content !== originalContent;
  const canSave = contentChanged && reason.trim().length > 0 && !saving;

  return (
    <div data-testid="prompt-editor-panel">
      {contentChanged && <span data-testid="unsaved-indicator">Unsaved changes</span>}
      <textarea
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        data-testid="prompt-editor"
      />
      <input
        type="text"
        value={reason}
        onChange={(e) => onReasonChange(e.target.value)}
        placeholder="Reason for change (required)"
        data-testid="prompt-reason"
      />
      <button
        onClick={onSave}
        disabled={!canSave}
        data-testid="prompt-save"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}

/* ---- Test fixtures ---- */

const SAMPLE_PROMPTS: PromptRow[] = [
  { id: 1, key: "exercise.role", content: "Your role: guide the learner...", version: 1, created_at: "2025-01-01", created_by: "seed", reason: "Initial" },
  { id: 2, key: "socratic.persona", content: "You are a Socratic tutor for...", version: 2, created_at: "2025-01-02", created_by: "admin", reason: "Updated tone" },
  { id: 3, key: "socratic.rules", content: "- NEVER refer to the learner in third person...", version: 1, created_at: "2025-01-01", created_by: "seed", reason: "Initial" },
];

/* ---- Tests ---- */

describe("PromptList", () => {
  it("renders prompt keys with content previews", () => {
    render(<PromptList prompts={SAMPLE_PROMPTS} selectedKey={null} onSelect={vi.fn()} />);
    expect(screen.getByTestId("prompt-list")).toBeDefined();
    expect(screen.getByTestId("prompt-key-exercise.role")).toBeDefined();
    expect(screen.getByTestId("prompt-key-socratic.persona")).toBeDefined();
    expect(screen.getByTestId("prompt-key-socratic.rules")).toBeDefined();
  });

  it("shows empty state when no prompts", () => {
    render(<PromptList prompts={[]} selectedKey={null} onSelect={vi.fn()} />);
    expect(screen.getByTestId("prompts-empty")).toBeDefined();
    expect(screen.getByText(/seed script/)).toBeDefined();
  });

  it("calls onSelect when clicking a prompt key", () => {
    const onSelect = vi.fn();
    render(<PromptList prompts={SAMPLE_PROMPTS} selectedKey={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("prompt-key-socratic.rules"));
    expect(onSelect).toHaveBeenCalledWith("socratic.rules");
  });

  it("highlights selected prompt", () => {
    render(<PromptList prompts={SAMPLE_PROMPTS} selectedKey="socratic.persona" onSelect={vi.fn()} />);
    const btn = screen.getByTestId("prompt-key-socratic.persona");
    expect(btn.style.fontWeight).toBe("bold");
  });
});

describe("PromptEditor", () => {
  it("shows editor with content", () => {
    render(
      <PromptEditor
        content="Current content"
        originalContent="Current content"
        reason=""
        onContentChange={vi.fn()}
        onReasonChange={vi.fn()}
        onSave={vi.fn()}
        saving={false}
      />
    );
    const editor = screen.getByTestId("prompt-editor") as HTMLTextAreaElement;
    expect(editor.value).toBe("Current content");
  });

  it("save button disabled when content unchanged", () => {
    render(
      <PromptEditor
        content="Same content"
        originalContent="Same content"
        reason="Some reason"
        onContentChange={vi.fn()}
        onReasonChange={vi.fn()}
        onSave={vi.fn()}
        saving={false}
      />
    );
    expect((screen.getByTestId("prompt-save") as HTMLButtonElement).disabled).toBe(true);
  });

  it("save button disabled when reason is empty", () => {
    render(
      <PromptEditor
        content="Changed content"
        originalContent="Original content"
        reason=""
        onContentChange={vi.fn()}
        onReasonChange={vi.fn()}
        onSave={vi.fn()}
        saving={false}
      />
    );
    expect((screen.getByTestId("prompt-save") as HTMLButtonElement).disabled).toBe(true);
  });

  it("save button enabled when content changed and reason provided", () => {
    render(
      <PromptEditor
        content="Changed content"
        originalContent="Original content"
        reason="Updated rules"
        onContentChange={vi.fn()}
        onReasonChange={vi.fn()}
        onSave={vi.fn()}
        saving={false}
      />
    );
    expect((screen.getByTestId("prompt-save") as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows unsaved changes indicator when content differs", () => {
    render(
      <PromptEditor
        content="Changed"
        originalContent="Original"
        reason=""
        onContentChange={vi.fn()}
        onReasonChange={vi.fn()}
        onSave={vi.fn()}
        saving={false}
      />
    );
    expect(screen.getByTestId("unsaved-indicator")).toBeDefined();
  });

  it("hides unsaved indicator when content matches original", () => {
    const { container } = render(
      <PromptEditor
        content="Same"
        originalContent="Same"
        reason=""
        onContentChange={vi.fn()}
        onReasonChange={vi.fn()}
        onSave={vi.fn()}
        saving={false}
      />
    );
    expect(container.querySelector('[data-testid="unsaved-indicator"]')).toBeNull();
  });

  it("calls onSave when save button clicked", () => {
    const onSave = vi.fn();
    render(
      <PromptEditor
        content="Changed"
        originalContent="Original"
        reason="reason"
        onContentChange={vi.fn()}
        onReasonChange={vi.fn()}
        onSave={onSave}
        saving={false}
      />
    );
    fireEvent.click(screen.getByTestId("prompt-save"));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("shows Saving... text while saving", () => {
    render(
      <PromptEditor
        content="Changed"
        originalContent="Original"
        reason="reason"
        onContentChange={vi.fn()}
        onReasonChange={vi.fn()}
        onSave={vi.fn()}
        saving={true}
      />
    );
    expect(screen.getByTestId("prompt-save").textContent).toBe("Saving...");
  });
});
