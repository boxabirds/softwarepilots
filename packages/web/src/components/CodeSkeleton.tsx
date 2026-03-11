/** Placeholder skeleton for the code editor during intro phase. */

const SKELETON_LINES = [
  "w-3/4",
  "w-1/2",
  "w-[85%]",
  "w-2/5",
  "w-3/5",
];

export function CodeSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3 bg-[#1e1e1e] px-5 py-4">
      {SKELETON_LINES.map((width, i) => (
        <div
          key={i}
          className={`h-4 rounded ${width} animate-pulse bg-white/10`}
        />
      ))}
    </div>
  );
}
