import { FieldLabel } from "./FieldLabel";

export function OutputCard({ index, output, selected, onClick }: {
  index: number;
  output: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`mt-3 cursor-pointer rounded-[10px] bg-background p-4 transition-colors duration-150 ${
        selected ? "border-[1.5px] border-primary" : "border-[1.5px] border-border"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <FieldLabel>Output (run #{index + 1})</FieldLabel>
        <span className="text-[11px] text-muted-foreground">
          {selected ? "viewing code \u2190" : "click to view code"}
        </span>
      </div>
      <pre className="m-0 overflow-x-auto whitespace-pre-wrap rounded-md bg-[#0d1117] px-4 py-3 font-mono text-[13px] leading-relaxed text-[#c9d1d9]">
        {output}
      </pre>
    </div>
  );
}
