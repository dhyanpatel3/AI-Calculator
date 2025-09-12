// In src/screens/home/index.tsx
import { useEffect, useRef, useState } from "react";
import Draggable from "react-draggable";
import axios from "axios";
import { Button, Group, Stack, Title } from "@mantine/core";

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
  const [dictOfVars, setDictOfVars] = useState<VarDict>({});
  const [latexExpression, setLatexExpression] = useState<LatexItem[]>([]);
  const [latexPosition] = useState<{ x: number; y: number }>({ x: 40, y: 40 });

  // Create a ref for the canvas element: canvasRef.
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // One-time setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.min(1024, window.innerWidth - 80);
    const height = Math.min(768, window.innerHeight - 220);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineWidth = 4;
      ctx.strokeStyle = color;
      ctxRef.current = ctx;
    }

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
    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update stroke color on change
  useEffect(() => {
    if (ctxRef.current) ctxRef.current.strokeStyle = color;
  }, [color]);

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
    if (!ctx) return;
    setIsDrawing(true);
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

  // Main API call
  async function runRoute() {
    const canvas = canvasRef.current;
    if (!canvas) return;
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
    }
  }

  const reset = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setLatexExpression([]);
    setDictOfVars({});
  };

  return (
    <Stack gap="md" className="p-4">
      <Title order={2}>AI iPad Calculator</Title>
      <Group>
        <Button onClick={reset} variant="light" color="gray">
          Reset
        </Button>
        <Button onClick={runRoute} color="blue">
          Run
        </Button>
        <Group gap="xs">
          {SWATCHES.map((c) => (
            <button
              key={c}
              className="w-6 h-6 rounded-full border border-white/20"
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`Pick ${c}`}
            />
          ))}
        </Group>
      </Group>

      <div className="relative">
        <canvas
          ref={canvasRef}
          className="rounded-xl border border-white/10 bg-surface"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />

        {latexExpression.map((l, idx) => (
          <Draggable
            key={l.id}
            defaultPosition={{
              x: latexPosition.x + idx * 10,
              y: latexPosition.y + idx * 10,
            }}
          >
            <div className="absolute select-none pointer-events-auto bg-black/30 px-2 py-1 rounded-lg animate-pop-in">
              <span dangerouslySetInnerHTML={{ __html: l.text }} />
            </div>
          </Draggable>
        ))}
      </div>
    </Stack>
  );
}
