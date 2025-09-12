// In src/screens/home/index.tsx
import { useEffect, useRef, useState, createRef } from "react";
import Draggable from "react-draggable";
import axios from "axios";
import { Button, Slider, Loader } from "@mantine/core";

const SWATCHES = [
  "#ffffff",
  "#000000",
  "#ef4444",
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#a855f7",
  "#14b8a6",
];

type VarDict = Record<string, number | string>;

type LatexItem = {
  text: string;
  id: string;
};

export default function Home() {
  // Define component state using useState
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState<string>("#ffffff");
  const [tool, setTool] = useState<"brush" | "eraser">("brush");
  const [lineWidth, setLineWidth] = useState<number>(4);
  const [dictOfVars, setDictOfVars] = useState<VarDict>({});
  const [latexExpression, setLatexExpression] = useState<LatexItem[]>([]);
  const [latexPosition, setLatexPosition] = useState<{ x: number; y: number }>({
    x: 40,
    y: 40,
  });
  const [history, setHistory] = useState<ImageData[]>([]);
  const [redoStack, setRedoStack] = useState<ImageData[]>([]);
  const [toast, setToast] = useState<{
    message: string;
    type?: "error" | "info";
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") return saved;
    }
    return "dark";
  });

  // Create a ref for the canvas element: canvasRef.
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // StrictMode-safe node refs for Draggable items (avoid findDOMNode)
  const nodeRefs = useRef<Record<string, React.RefObject<HTMLDivElement>>>({});
  const getNodeRef = (id: string) => {
    if (!nodeRefs.current[id])
      nodeRefs.current[id] = createRef<HTMLDivElement>();
    return nodeRefs.current[id];
  };

  // One-time setup
  useEffect(() => {
    const setup = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const height = container.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";

      const ctx = canvas.getContext("2d", {
        willReadFrequently: true,
      }) as CanvasRenderingContext2D | null;
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); // reset any prior scale
        ctx.scale(dpr, dpr);
        ctx.lineCap = "round";
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = color;
        ctxRef.current = ctx;
      }

      // default label position: slightly below the vertical center
      const centerX = Math.floor(width / 2);
      const centerY = Math.floor(height / 2);
      const offsetY = Math.max(40, Math.floor(height * 0.08));
      setLatexPosition({ x: centerX, y: centerY + offsetY });
    };

    setup();
    const onResize = () => setup();
    window.addEventListener("resize", onResize);

    // MathJax loader (configure BEFORE loading script)
    const w = window as any;
    if (!w.__MATHJAX_LOADED__) {
      w.MathJax = {
        tex: {
          inlineMath: [
            ["$", "$"],
            ["\\(", "\\)"],
          ],
        },
        startup: { typeset: false },
      };
      const existing = document.getElementById("mathjax-script");
      if (!existing) {
        const script = document.createElement("script");
        script.id = "mathjax-script";
        script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js";
        script.async = true;
        script.onload = () => {
          w.__MATHJAX_LOADED__ = true;
        };
        document.head.appendChild(script);
      }
    }
    // Do not remove MathJax script on unmount to avoid reload issues
    return () => {
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply theme class to <html> and persist preference
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }
    try {
      localStorage.setItem("theme", theme);
    } catch {}
  }, [theme]);

  // Update stroke color on change
  useEffect(() => {
    if (ctxRef.current) ctxRef.current.strokeStyle = color;
  }, [color]);

  // Update stroke width on change
  useEffect(() => {
    if (ctxRef.current) ctxRef.current.lineWidth = lineWidth;
  }, [lineWidth]);

  // Re-typeset on latex change
  useEffect(() => {
    const MJ = (window as any).MathJax;
    if (MJ && MJ.typesetPromise) {
      MJ.typesetPromise();
    }
  }, [latexExpression]);

  // Drawing handlers
  const getPos = (e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    // snapshot BEFORE drawing starts so undo returns to prior state
    try {
      const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistory((h) => [...h, snap]);
      setRedoStack([]);
    } catch {}
    setIsDrawing(true);
    // set composite mode based on tool
    ctx.globalCompositeOperation =
      tool === "eraser" ? "destination-out" : "source-over";
    if (tool === "brush") {
      ctx.strokeStyle = color;
    }
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const ctx = ctxRef.current;
    if (!ctx || !isDrawing) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    setIsDrawing(false);
    ctx.closePath();
  };

  // Undo/Redo helpers
  const restoreImage = (img: ImageData) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.putImageData(img, 0, 0);
  };

  const undo = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      // push current to redo
      try {
        const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setRedoStack((r) => [...r, current]);
      } catch {}
      restoreImage(prev);
      return h.slice(0, -1);
    });
  };

  const redo = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    setRedoStack((r) => {
      if (r.length === 0) return r;
      const next = r[r.length - 1];
      try {
        const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory((h) => [...h, current]);
      } catch {}
      restoreImage(next);
      return r.slice(0, -1);
    });
  };

  // Main API call
  async function runRoute() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setLoading(true);
    const dataUrl = canvas.toDataURL("image/png");
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/calculate`,
        {
          image: dataUrl,
          dict_of_vars: dictOfVars,
        }
      );

      const items: Array<{ expr: string; result: any; assign?: boolean }> =
        res.data;
      const newLatex: LatexItem[] = [];
      const newVars: VarDict = { ...dictOfVars };

      for (const it of items) {
        if (it.assign) {
          // assign variable
          if (typeof it.expr === "string") {
            newVars[it.expr] = it.result;
          }
        }
        // Build latex string
        const text = `\\(\\LARGE{${String(it.expr)} = ${String(it.result)}}\\)`;
        newLatex.push({ text, id: crypto.randomUUID() });
      }

      setDictOfVars(newVars);
      setLatexExpression((prev) => [...prev, ...newLatex]);
    } catch (err: any) {
      const data = err?.response?.data;
      console.error("API error", err?.message || err, data);
      // Optional: quick toast for visibility
      setToast({
        message: "Unable to analyze right now. Please try again.",
        type: "error",
      });
      setTimeout(() => setToast(null), 2500);
    } finally {
      setLoading(false);
    }
  }

  const reset = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    // make reset undoable
    try {
      const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistory((h) => [...h, current]);
      setRedoStack([]);
    } catch {}
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setLatexExpression([]);
    setDictOfVars({});
  };

  // Keyboard shortcuts: Ctrl/Cmd+Z (undo), Ctrl+Shift+Z or Ctrl+Y (redo), Ctrl+Enter (run), Ctrl+Backspace/Delete (reset)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const ctrlOrCmd = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (ctrlOrCmd && key === "z") {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        e.preventDefault();
      } else if (ctrlOrCmd && key === "y") {
        redo();
        e.preventDefault();
      } else if (ctrlOrCmd && key === "enter") {
        runRoute();
        e.preventDefault();
      } else if (ctrlOrCmd && (key === "backspace" || key === "delete")) {
        reset();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen overflow-hidden bg-white text-gray-900 dark:bg-black dark:text-white"
    >
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <Loader color="blue" size="lg" />
        </div>
      )}
      {/* Toast */}
      {toast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
          <div
            className={`px-4 py-2 rounded-md shadow border ${
              toast.type === "error"
                ? "bg-red-500/20 border-red-400 text-red-200"
                : "bg-white/10 border-white/20 text-white"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
      {/* Full-screen canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      />

      {/* Top-left logo */}
      <div className="absolute top-5 left-14 z-20">
        <h1 className="text-gray-900 dark:text-white text-xl sm:text-3xl font-extrabold tracking-wide select-none">
          AI Calculator.
        </h1>
      </div>

      {/* Top-centered palette */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-3 bg-black/5 dark:bg-white/10 backdrop-blur-md border border-black/10 dark:border-white/15 rounded-full px-3 py-2 shadow-lg">
          {SWATCHES.map((c) => {
            const active = c.toLowerCase() === color.toLowerCase();
            return (
              <button
                key={c}
                className={`w-7 h-7 rounded-full border border-white/20 transition-transform hover:scale-105 ${
                  active ? "ring-2 ring-white" : ""
                }`}
                style={{ background: c }}
                onClick={() => {
                  setColor(c);
                  setTool("brush");
                }}
                aria-label={`Pick ${c}`}
                aria-pressed={active}
              />
            );
          })}
          <div className="w-px h-6 bg-white/20 mx-1" />
          <Button
            size="xs"
            variant={tool === "eraser" ? "filled" : "light"}
            color="gray"
            onClick={() =>
              setTool((t) => (t === "eraser" ? "brush" : "eraser"))
            }
          >
            {tool === "eraser" ? "Eraser: ON" : "Eraser"}
          </Button>
          <div className="flex items-center gap-2 w-36">
            <span className="text-xs text-gray-700 dark:text-white/70">
              Size
            </span>
            <Slider
              min={1}
              max={24}
              step={1}
              value={lineWidth}
              onChange={setLineWidth}
              className="flex-1"
            />
          </div>
          <div className="w-px h-6 bg-white/20 mx-1" />
          {/* Aligned control buttons inside the color bar */}
          <Button
            size="xs"
            onClick={undo}
            variant="light"
            color="gray"
            disabled={history.length === 0 || loading}
          >
            Undo
          </Button>
          <Button
            size="xs"
            onClick={redo}
            variant="light"
            color="gray"
            disabled={redoStack.length === 0 || loading}
          >
            Redo
          </Button>
          <Button
            size="xs"
            onClick={reset}
            variant="light"
            color="gray"
            disabled={loading}
          >
            Reset
          </Button>
          <Button size="xs" onClick={runRoute} color="blue" disabled={loading}>
            Run
          </Button>
          <div className="w-px h-6 bg-white/20 mx-1" />
        </div>
      </div>

      {/* Top-right GitHub button */}
      <a
        href="https://github.com/dhyanpatel3/AI-Calculator"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-5 right-12 z-20 group"
        aria-label="Open GitHub repository"
        title="Open GitHub repository"
      >
        <div className="p-2 rounded-full bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 hover:bg-black/10 dark:hover:bg-white/20 transition-colors shadow">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="w-5 h-5 text-gray-900 dark:text-white"
            fill="currentColor"
          >
            <path d="M12 .5C5.73.5.98 5.24.98 11.52c0 4.86 3.15 8.98 7.52 10.43.55.1.75-.24.75-.53 0-.26-.01-1.12-.02-2.04-3.06.66-3.71-1.3-3.71-1.3-.5-1.28-1.22-1.62-1.22-1.62-1-.69.08-.68.08-.68 1.1.08 1.68 1.13 1.68 1.13.98 1.67 2.57 1.19 3.2.91.1-.71.38-1.19.69-1.46-2.44-.28-5-1.22-5-5.43 0-1.2.43-2.17 1.13-2.94-.11-.28-.49-1.42.11-2.95 0 0 .92-.3 3.02 1.12a10.5 10.5 0 0 1 5.5 0c2.1-1.42 3.02-1.12 3.02-1.12.6 1.53.22 2.67.11 2.95.7.77 1.13 1.74 1.13 2.94 0 4.22-2.57 5.15-5.01 5.42.39.34.73 1 .73 2.02 0 1.46-.01 2.64-.01 3 0 .29.2.64.76.53 4.36-1.45 7.51-5.57 7.51-10.43C23.02 5.24 18.27.5 12 .5z" />
          </svg>
        </div>
      </a>

      {/* Draggable results */}
      {latexExpression.map((l, idx) => {
        const nodeRef = getNodeRef(l.id);
        return (
          <Draggable
            key={l.id}
            nodeRef={nodeRef}
            defaultPosition={{
              x: latexPosition.x + idx * 10,
              y: latexPosition.y + idx * 10,
            }}
          >
            <div
              ref={nodeRef}
              className="absolute select-none pointer-events-auto bg-black/40 px-2 py-1 rounded-lg animate-pop-in border border-white/10 shadow"
            >
              <span dangerouslySetInnerHTML={{ __html: l.text }} />
            </div>
          </Draggable>
        );
      })}
    </div>
  );
}
