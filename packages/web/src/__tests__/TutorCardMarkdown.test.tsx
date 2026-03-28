import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TutorCard } from "../components/exercise/TutorCard";

afterEach(cleanup);

describe("TutorCard inline markdown rendering", () => {
  it("renders **bold** as <strong> element", () => {
    render(<TutorCard content="This is **resource exhaustion**. It matters." />);
    const strong = document.querySelector("strong");
    expect(strong).toBeTruthy();
    expect(strong!.textContent).toBe("resource exhaustion");
  });

  it("renders *italic* as <em> element", () => {
    render(<TutorCard content="This is *important* to understand." />);
    const em = document.querySelector("em");
    expect(em).toBeTruthy();
    expect(em!.textContent).toBe("important");
  });

  it("renders `code` as <code> element", () => {
    render(<TutorCard content="Use the `forEach` method." />);
    const code = document.querySelector("code");
    expect(code).toBeTruthy();
    expect(code!.textContent).toBe("forEach");
  });

  it("renders plain text without crashing", () => {
    render(<TutorCard content="Just plain text, no markdown." />);
    expect(screen.getByText("Just plain text, no markdown.")).toBeTruthy();
  });

  it("renders instruction variant with markdown without crashing", () => {
    render(
      <TutorCard
        content="This is a **key concept** to understand."
        variant="instruction"
      />
    );
    expect(document.querySelector("strong")).toBeTruthy();
  });

  it("renders loading state without markdown", () => {
    render(<TutorCard content="" loading />);
    expect(screen.getByText("Thinking...")).toBeTruthy();
  });

  it("handles multiple bold segments in one string", () => {
    render(<TutorCard content="Both **first** and **second** are bold." />);
    const strongs = document.querySelectorAll("strong");
    expect(strongs.length).toBe(2);
    expect(strongs[0].textContent).toBe("first");
    expect(strongs[1].textContent).toBe("second");
  });
});
