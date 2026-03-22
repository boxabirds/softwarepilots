interface ConsoleProps {
  output: string;
}

export function Console({ output }: ConsoleProps) {
  if (!output) {
    return (
      <div className="bg-[#0d1117] px-5 py-2">
        <span className="text-xs text-[#484f58]">Output</span>
      </div>
    );
  }

  return (
    <div className="max-h-48 overflow-y-auto bg-[#0d1117] px-5 py-3 font-mono text-[0.8125rem] leading-5 text-[#c9d1d9]">
      <pre className="m-0 whitespace-pre-wrap">{output}</pre>
    </div>
  );
}
