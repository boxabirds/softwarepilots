const SUBMIT_BUTTON_SIZE_PX = "32px";

export function SubmitArrow({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!active}
      className={`flex shrink-0 items-center justify-center rounded-full border-none text-base transition-colors duration-150 ${
        active
          ? "cursor-pointer bg-primary text-primary-foreground"
          : "cursor-default bg-muted text-muted-foreground"
      }`}
      style={{ width: SUBMIT_BUTTON_SIZE_PX, height: SUBMIT_BUTTON_SIZE_PX }}
      aria-label="Submit"
    >
      &#8593;
    </button>
  );
}
