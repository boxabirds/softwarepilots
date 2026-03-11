import Markdown from "react-markdown";

interface NarrativeProps {
  text: string;
}

export function Narrative({ text }: NarrativeProps) {
  return (
    <div className="space-y-4">
      <Markdown
        components={{
          p: ({ children }) => (
            <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              {children}
            </code>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-muted-foreground/60">
              {children}
            </ol>
          ),
          li: ({ children }) => <li>{children}</li>,
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
