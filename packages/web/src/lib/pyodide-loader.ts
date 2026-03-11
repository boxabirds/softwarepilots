declare global {
  interface Window {
    loadPyodide: (config?: { indexURL?: string }) => Promise<PyodideInterface>;
  }
}

export interface PyodideInterface {
  runPython: (code: string) => unknown;
  setStdout: (options: { batched: (text: string) => void }) => void;
  setStderr: (options: { batched: (text: string) => void }) => void;
}

const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.27.0/full/";
const EXECUTION_TIMEOUT_MS = 5000;

let pyodidePromise: Promise<PyodideInterface> | null = null;

export function loadPyodideRuntime(): Promise<PyodideInterface> {
  if (pyodidePromise) return pyodidePromise;

  pyodidePromise = new Promise<PyodideInterface>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${PYODIDE_CDN}pyodide.js`;
    script.onload = async () => {
      try {
        const pyodide = await window.loadPyodide({ indexURL: PYODIDE_CDN });
        resolve(pyodide);
      } catch (err) {
        reject(err);
      }
    };
    script.onerror = () => reject(new Error("Failed to load Pyodide. Requires a modern browser with WebAssembly support."));
    document.head.appendChild(script);
  });

  return pyodidePromise;
}

export async function executePython(
  pyodide: PyodideInterface,
  code: string
): Promise<{ stdout: string; stderr: string }> {
  let stdout = "";
  let stderr = "";

  pyodide.setStdout({ batched: (text: string) => { stdout += text + "\n"; } });
  pyodide.setStderr({ batched: (text: string) => { stderr += text + "\n"; } });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Execution timed out (5 second limit)")), EXECUTION_TIMEOUT_MS)
  );

  const execPromise = (async () => {
    try {
      pyodide.runPython(code);
    } catch (err) {
      stderr += err instanceof Error ? err.message : String(err);
    }
    return { stdout: stdout.trimEnd(), stderr: stderr.trimEnd() };
  })();

  return Promise.race([execPromise, timeoutPromise]);
}
