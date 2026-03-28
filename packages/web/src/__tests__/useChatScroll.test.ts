import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChatScroll } from "../hooks/useChatScroll";

// Stub scrollTo since jsdom doesn't implement it
Element.prototype.scrollTo = vi.fn();

describe("useChatScroll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns chatRef, showScrollButton, and scrollToBottom", () => {
    const { result } = renderHook(() =>
      useChatScroll({ deps: [0, false] })
    );

    expect(result.current.chatRef).toBeDefined();
    expect(result.current.showScrollButton).toBe(false);
    expect(typeof result.current.scrollToBottom).toBe("function");
  });

  it("showScrollButton starts as false", () => {
    const { result } = renderHook(() =>
      useChatScroll({ deps: [0, false] })
    );

    expect(result.current.showScrollButton).toBe(false);
  });

  it("scrollToBottom sets showScrollButton to false", () => {
    const { result } = renderHook(() =>
      useChatScroll({ deps: [0, false] })
    );

    act(() => {
      result.current.scrollToBottom();
    });

    expect(result.current.showScrollButton).toBe(false);
  });

  it("scrollToBottom calls scrollTo with smooth behaviour", () => {
    const scrollToSpy = vi.mocked(Element.prototype.scrollTo);
    const { result } = renderHook(() =>
      useChatScroll({ deps: [0, false] })
    );

    // Attach a mock div to chatRef
    const mockDiv = document.createElement("div");
    Object.defineProperty(result.current.chatRef, "current", {
      value: mockDiv,
      writable: true,
    });

    act(() => {
      result.current.scrollToBottom();
    });

    const smoothCalls = scrollToSpy.mock.calls.filter(
      (call) => call[0] && typeof call[0] === "object" && (call[0] as ScrollToOptions).behavior === "smooth"
    );
    expect(smoothCalls.length).toBe(1);
  });
});
