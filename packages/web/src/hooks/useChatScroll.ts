import { useRef, useState, useCallback, useEffect } from "react";

const SCROLL_BOTTOM_THRESHOLD = 50;
const SCROLL_THROTTLE_MS = 100;

interface UseChatScrollOptions {
  /** Triggers auto-scroll when these change: [conversationLength, sending] */
  deps: [number, boolean];
}

interface UseChatScrollReturn {
  chatRef: React.RefObject<HTMLDivElement | null>;
  showScrollButton: boolean;
  scrollToBottom: () => void;
}

export function useChatScroll({ deps }: UseChatScrollOptions): UseChatScrollReturn {
  const chatRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const lastScrollUpdate = useRef(0);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const [conversationLength, sending] = deps;

  const scrollToBottom = useCallback(() => {
    const el = chatRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    isAtBottomRef.current = true;
    setShowScrollButton(false);
  }, []);

  const handleChatScroll = useCallback(() => {
    const el = chatRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_BOTTOM_THRESHOLD;
    isAtBottomRef.current = atBottom;
    const now = Date.now();
    if (now - lastScrollUpdate.current >= SCROLL_THROTTLE_MS) {
      lastScrollUpdate.current = now;
      setShowScrollButton(!atBottom);
    }
  }, []);

  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleChatScroll);
    return () => el.removeEventListener("scroll", handleChatScroll);
  }, [handleChatScroll]);

  useEffect(() => {
    if (!isAtBottomRef.current) return;
    const el = chatRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "instant" });
  }, [conversationLength, sending]);

  return { chatRef, showScrollButton, scrollToBottom };
}
