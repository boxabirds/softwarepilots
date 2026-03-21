import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ReviewBadge } from "../components/ReviewBadge";

afterEach(cleanup);

function renderBadge(props: {
  concept: string;
  daysOverdue: number;
  profile?: string;
  sectionId?: string;
}) {
  return render(
    <MemoryRouter>
      <ReviewBadge
        concept={props.concept}
        daysOverdue={props.daysOverdue}
        profile={props.profile ?? "new-grad"}
        sectionId={props.sectionId ?? "1.1"}
      />
    </MemoryRouter>
  );
}

describe("ReviewBadge", () => {
  it("shows concept name", () => {
    renderBadge({ concept: "concurrency", daysOverdue: 3 });
    expect(screen.getByText("concurrency")).toBeTruthy();
  });

  it("shows days overdue (plural)", () => {
    renderBadge({ concept: "testing", daysOverdue: 5 });
    expect(screen.getByText("5 days overdue")).toBeTruthy();
  });

  it("shows singular day overdue", () => {
    renderBadge({ concept: "testing", daysOverdue: 1 });
    expect(screen.getByText("1 day overdue")).toBeTruthy();
  });

  it("shows 'Due today' when 0 days overdue", () => {
    renderBadge({ concept: "testing", daysOverdue: 0 });
    expect(screen.getByText("Due today")).toBeTruthy();
  });

  it("links to the correct Socratic session", () => {
    renderBadge({
      concept: "testing",
      daysOverdue: 2,
      profile: "veteran",
      sectionId: "2.3",
    });

    const link = screen.getByTestId("review-badge");
    expect(link.getAttribute("href")).toBe("/curriculum/veteran/2.3");
  });
});
