export function TutorCard({ content, loading }: { content: string; loading?: boolean }) {
  return (
    <div className="mr-10 mt-3 rounded-[10px] border border-border border-l-[3px] border-l-primary bg-muted p-4">
      {loading ? (
        <div className="flex items-center gap-2 py-0.5">
          <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-[13px] text-muted-foreground">Thinking...</span>
        </div>
      ) : (
        <div className="text-[13px] leading-relaxed text-foreground">{content}</div>
      )}
    </div>
  );
}
