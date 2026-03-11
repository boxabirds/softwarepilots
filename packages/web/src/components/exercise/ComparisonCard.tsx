import { FieldLabel } from "./FieldLabel";

export function ComparisonCard({ prediction, output, selected, onClick }: {
  prediction: string;
  output: string;
  selected: boolean;
  onClick: () => void;
}) {
  const match = prediction.trim() === output.trim();
  return (
    <div
      onClick={onClick}
      className={`mt-3 cursor-pointer rounded-[10px] bg-background p-4 transition-colors duration-150 ${
        selected ? "border-[1.5px] border-primary" : "border-[1.5px] border-border"
      }`}
    >
      <div className="mb-2 flex gap-4">
        <div className="flex-1">
          <FieldLabel>Your prediction</FieldLabel>
          <pre className="m-0 whitespace-pre-wrap rounded-md bg-[#0d1117] px-3 py-2.5 font-mono text-[13px] leading-relaxed text-[#c9d1d9]">
            {prediction}
          </pre>
        </div>
        <div className="flex-1">
          <FieldLabel>Actual output</FieldLabel>
          <pre className="m-0 whitespace-pre-wrap rounded-md bg-[#0d1117] px-3 py-2.5 font-mono text-[13px] leading-relaxed text-[#c9d1d9]">
            {output}
          </pre>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold ${match ? "text-success" : "text-warning"}`}>
          {match ? "Exact match!" : "Not quite \u2014 spot the difference"}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {selected ? "viewing code \u2190" : "click to view code"}
        </span>
      </div>
    </div>
  );
}
