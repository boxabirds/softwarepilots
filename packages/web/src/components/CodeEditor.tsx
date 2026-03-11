import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { loadPyodideRuntime, executePython, type PyodideInterface } from "../lib/pyodide-loader";
import { getExerciseMeta } from "@softwarepilots/shared";

export interface CodeEditorHandle {
  run: () => void;
  focus: () => void;
}

interface CodeEditorProps {
  exerciseId: string;
  onCodeChange: (code: string) => void;
  onRun: (output: string) => void;
  disabled?: boolean;
  onReadyChange?: (ready: boolean) => void;
}

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(
  function CodeEditor({ exerciseId, onCodeChange, onRun, disabled, onReadyChange }, ref) {
    const initialCode = getExerciseMeta(exerciseId).starter_code;
    const [code, setCode] = useState(initialCode);
    const [pyodide, setPyodide] = useState<PyodideInterface | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [running, setRunning] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
      loadPyodideRuntime()
        .then(setPyodide)
        .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load Python runtime"))
        .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
      onCodeChange(initialCode);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      const ready = !loading && !loadError;
      onReadyChange?.(ready);
    }, [loading, loadError, onReadyChange]);

    const updateCode = (newCode: string) => {
      setCode(newCode);
      onCodeChange(newCode);
    };

    const handleRun = async () => {
      if (!pyodide || running || disabled) return;
      setRunning(true);
      try {
        const { stdout, stderr } = await executePython(pyodide, code);
        const output = stderr ? `${stdout}\n\nError:\n${stderr}` : stdout;
        onRun(output);
      } catch (err) {
        onRun(`Error: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setRunning(false);
      }
    };

    useImperativeHandle(ref, () => ({
      run: handleRun,
      focus: () => textareaRef.current?.focus(),
    }));

    if (loadError) {
      return (
        <div className="flex h-full items-center justify-center p-6 text-destructive">
          <div className="text-center">
            <p className="font-semibold">Python runtime failed to load</p>
            <p className="mt-1 text-sm">{loadError}</p>
            <p className="mt-1 text-sm text-muted-foreground">Requires a modern browser with WebAssembly.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col bg-[#1e1e1e]">
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => updateCode(e.target.value)}
          disabled={disabled}
          spellCheck={false}
          className="flex-1 resize-none border-none bg-transparent px-5 py-4 font-mono text-[13px] leading-6 text-[#d4d4d4] outline-none"
          style={{ tabSize: 4 }}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              const start = e.currentTarget.selectionStart;
              const end = e.currentTarget.selectionEnd;
              const newCode = code.substring(0, start) + "    " + code.substring(end);
              updateCode(newCode);
              requestAnimationFrame(() => {
                if (textareaRef.current) {
                  textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4;
                }
              });
            }
          }}
        />
      </div>
    );
  }
);
