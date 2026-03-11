export function InputPill({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-end gap-2 rounded-[20px] border border-border bg-background px-4 py-3 shadow-sm">
      {children}
    </div>
  );
}
