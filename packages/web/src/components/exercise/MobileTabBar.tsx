export type MobileTab = "exercise" | "code";

export function MobileTabBar({
  activeTab,
  onTabChange,
  codeDisabled,
}: {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  codeDisabled?: boolean;
}) {
  return (
    <div className="flex border-t border-border bg-background md:hidden">
      <button
        onClick={() => onTabChange("exercise")}
        className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
          activeTab === "exercise"
            ? "border-t-2 border-primary text-primary"
            : "text-muted-foreground"
        }`}
      >
        Exercise
      </button>
      <button
        onClick={() => !codeDisabled && onTabChange("code")}
        disabled={codeDisabled}
        className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
          codeDisabled
            ? "cursor-not-allowed text-muted-foreground/50"
            : activeTab === "code"
              ? "border-t-2 border-primary text-primary"
              : "text-muted-foreground"
        }`}
      >
        Code
      </button>
    </div>
  );
}
