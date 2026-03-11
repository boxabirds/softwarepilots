export function ChatCard({ children, muted, align }: {
  children: React.ReactNode;
  muted?: boolean;
  align?: "right";
}) {
  return (
    <div className={`mt-3 rounded-[10px] border border-border p-4 ${
      muted ? "bg-muted" : "bg-background"
    } ${align === "right" ? "ml-10" : ""}`}>
      {children}
    </div>
  );
}
