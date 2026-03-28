export function AIDisclaimer() {
  return (
    <div
      className="flex items-start gap-2 text-xs leading-relaxed"
      style={{ color: "var(--text-muted)" }}
      data-testid="ai-disclaimer"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="mt-0.5 shrink-0"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 7v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="4.5" r="0.75" fill="currentColor" />
      </svg>
      <span>
        This content is AI-generated and may occasionally contain inaccuracies. Your critical
        thinking is part of the learning process.
      </span>
    </div>
  );
}
