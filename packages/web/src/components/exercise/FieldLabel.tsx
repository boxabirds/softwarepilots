export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-xs font-medium text-muted-foreground">
      {children}
    </div>
  );
}
