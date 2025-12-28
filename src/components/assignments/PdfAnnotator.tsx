// src/components/assignments/PdfAnnotator.tsx
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// PDF.js (legacy para Vite)
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

// Tipos para las anotaciones
interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  size: number;
  tool: "pen" | "eraser";
}

type PageStrokes = Record<number, Stroke[]>;

type Props = {
  pdfUrl: string; // signed url / public url
  fileName: string;
  mimeType?: string | null;
  submissionId: string;

  storageBucket?: string; // default: "student-submissions"
  storagePath?: string | null; // ruta dentro del bucket del PDF original (recomendado)

  onSaved?: () => void;
  onClose?: () => void;
};

function safeKeyName(input: string) {
  // 1) quita tildes/diacríticos (SIMULACIÓN -> SIMULACION)
  // 2) reemplaza espacios por _
  // 3) deja solo [a-zA-Z0-9._-]
  const noDiacritics = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return noDiacritics
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function fetchAsPdfBytes(pdfUrl: string) {
  const res = await fetch(pdfUrl, { mode: "cors" });
  if (!res.ok) throw new Error(`fetch pdfUrl failed: ${res.status}`);

  const ct = (res.headers.get("content-type") || "").toLowerCase();

  // Si te está devolviendo HTML (por URL expirada o error), PDF.js revienta con InvalidPDFException
  if (ct.includes("text/html")) {
    const preview = (await res.text()).slice(0, 120);
    throw new Error(
      `La URL no devolvió PDF (parece HTML). Ejemplo: ${preview}`
    );
  }

  // a veces viene octet-stream y es PDF igual, no lo bloqueamos duro
  const buf = await res.arrayBuffer();
  return buf;
}

export default function PdfAnnotator({
  pdfUrl,
  fileName,
  submissionId,
  storageBucket = "student-submissions",
  storagePath = null,
  onSaved,
  onClose,
}: Props) {
  // canvas base: página renderizada (no se dibuja encima)
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // canvas overlay: anotaciones (sí se dibuja)
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [pdfDocJs, setPdfDocJs] = useState<any>(null);
  const [pageCount, setPageCount] = useState(1);
  const [pageNum, setPageNum] = useState(1);

  // herramientas
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState("#ff0000");
  const [size, setSize] = useState(3);

  // dibujo
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const currentStroke = useRef<Point[]>([]);

  // ✅ Guardar trazos por página (en lugar de dataURL)
  const [pageStrokes, setPageStrokes] = useState<PageStrokes>({});

  // escala fija (para que overlay y base calcen)
  const SCALE = 1.35;

  // worker
  useEffect(() => {
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;
  }, []);

  // ===== CARGA DEL PDF =====
  useEffect(() => {
    let cancelled = false;
    let timeoutId: NodeJS.Timeout;

    async function load() {
      try {
        setLoading(true);

        // Timeout de 30 segundos para evitar cuelgues
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Timeout al cargar PDF')), 30000);
        });

        // 1) intenta por URL
        try {
          const loadPromise = fetchAsPdfBytes(pdfUrl);
          const buf = await Promise.race([loadPromise, timeoutPromise]) as ArrayBuffer;
          if (cancelled) return;
          clearTimeout(timeoutId);
          
          // Verificar tamaño del PDF (máximo 10MB para evitar cuelgues)
          const sizeMB = buf.byteLength / (1024 * 1024);
          if (sizeMB > 10) {
            toast.error(`El PDF es demasiado grande (${sizeMB.toFixed(1)}MB). Máximo 10MB para anotaciones.`);
            setLoading(false);
            return;
          }
          
          setPdfBytes(buf);
          return;
        } catch (e) {
          clearTimeout(timeoutId);
          // 2) fallback: storage.download (más estable si tienes storagePath)
          if (!storagePath) throw e;

          const downloadPromise = supabase.storage
            .from(storageBucket)
            .download(storagePath);
          
          const { data, error } = await Promise.race([
            downloadPromise, 
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout descargando PDF')), 30000))
          ]) as any;

          if (error) throw error;

          const buf = await data.arrayBuffer();
          if (cancelled) return;
          
          // Verificar tamaño del PDF
          const sizeMB = buf.byteLength / (1024 * 1024);
          if (sizeMB > 10) {
            toast.error(`El PDF es demasiado grande (${sizeMB.toFixed(1)}MB). Máximo 10MB para anotaciones.`);
            setLoading(false);
            return;
          }
          
          setPdfBytes(buf);
        }
      } catch (err: any) {
        console.error("PDF load error:", err);
        toast.error(`No se pudo cargar el PDF: ${err?.message || 'Error desconocido'}`);
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [pdfUrl, storageBucket, storagePath]);

  // ===== INIT PDF.JS =====
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!pdfBytes) return;
      try {
        const task = (pdfjsLib as any).getDocument({ data: pdfBytes });
        const doc = await task.promise;
        if (cancelled) return;
        setPdfDocJs(doc);
        setPageCount(doc.numPages);
        setPageNum(1);
      } catch (err) {
        console.error("PDF init error:", err);
        toast.error("No se pudo inicializar el visor del PDF");
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [pdfBytes]);

  // ===== RENDER PÁGINA =====
  useEffect(() => {
    let cancelled = false;

    async function renderPage() {
      if (!pdfDocJs || !baseCanvasRef.current || !overlayCanvasRef.current)
        return;

      try {
        const page = await pdfDocJs.getPage(pageNum);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: SCALE });

        const base = baseCanvasRef.current;
        base.width = Math.floor(viewport.width);
        base.height = Math.floor(viewport.height);

        const overlay = overlayCanvasRef.current;
        overlay.width = base.width;
        overlay.height = base.height;

        // render base
        const bctx = base.getContext("2d")!;
        await page.render({ canvasContext: bctx, viewport }).promise;

        // restore strokes (redibujar desde el array de strokes)
        const octx = overlay.getContext("2d")!;
        octx.clearRect(0, 0, overlay.width, overlay.height);

        const strokes = pageStrokes[pageNum] || [];
        for (const stroke of strokes) {
          if (stroke.points.length < 2) continue;

          octx.lineCap = "round";
          octx.lineJoin = "round";
          octx.lineWidth = stroke.size;

          if (stroke.tool === "eraser") {
            octx.globalCompositeOperation = "destination-out";
            octx.strokeStyle = "rgba(0,0,0,1)";
          } else {
            octx.globalCompositeOperation = "source-over";
            octx.strokeStyle = stroke.color;
          }

          octx.beginPath();
          octx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length; i++) {
            octx.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
          octx.stroke();
        }
      } catch (err) {
        console.error("Render page error:", err);
        toast.error("No se pudo renderizar la página");
      }
    }

    renderPage();
    return () => {
      cancelled = true;
    };
  }, [pdfDocJs, pageNum, pageStrokes]);

  // ===== helpers dibujo =====
  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const saveCurrentStroke = () => {
    if (currentStroke.current.length < 2) return;

    const newStroke: Stroke = {
      points: [...currentStroke.current],
      color,
      size,
      tool,
    };

    setPageStrokes((prev) => ({
      ...prev,
      [pageNum]: [...(prev[pageNum] || []), newStroke],
    }));

    currentStroke.current = [];
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const pos = getPos(e);
    last.current = pos;
    currentStroke.current = [pos];
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !overlayCanvasRef.current) return;

    const ctx = overlayCanvasRef.current.getContext("2d")!;
    const p = getPos(e);
    const prev = last.current;
    if (!prev) return;

    currentStroke.current.push(p);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = size;

    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
    }

    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    last.current = p;
  };

  const onPointerUp = () => {
    if (drawing.current) {
      saveCurrentStroke();
    }
    drawing.current = false;
    last.current = null;
  };

  const clearOverlay = () => {
    if (!overlayCanvasRef.current) return;
    const ctx = overlayCanvasRef.current.getContext("2d")!;
    ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    setPageStrokes((prev) => {
      const copy = { ...prev };
      delete copy[pageNum];
      return copy;
    });
  };

  const goPrev = () => {
    setPageNum((p) => Math.max(1, p - 1));
  };


  const goNext = () => {
    setPageNum((p) => Math.min(pageCount, p + 1));
  };

  // ===== GUARDAR PDF COMPLETO (enviar a Edge Function) =====
  const savePdfComplete = async () => {
    const toastId = "savepdf";
    try {
      // Verificar que haya anotaciones
      const totalStrokes = Object.values(pageStrokes).reduce((sum, strokes) => sum + strokes.length, 0);
      if (totalStrokes === 0) {
        toast.error("No hay anotaciones para guardar", { id: toastId });
        return;
      }

      toast.loading("Renderizando anotaciones...", { id: toastId });

      // Renderizar cada página con anotaciones como PNG
      const pageImages: Record<string, string> = {};
      
      for (const [pageNumStr, strokes] of Object.entries(pageStrokes)) {
        if (!strokes || strokes.length === 0) continue;
        
        const pageNum = parseInt(pageNumStr);
        const page = await pdfDocJs.getPage(pageNum);
        const viewport = page.getViewport({ scale: SCALE });
        
        // Crear canvas temporal para renderizar esta página
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = viewport.width;
        tempCanvas.height = viewport.height;
        const tempCtx = tempCanvas.getContext("2d");
        if (!tempCtx) continue;
        
        // Renderizar PDF en el canvas
        await page.render({ canvasContext: tempCtx, viewport }).promise;
        
        // Dibujar las anotaciones encima
        for (const stroke of strokes) {
          if (stroke.points.length < 2) continue;
          
          tempCtx.lineCap = "round";
          tempCtx.lineJoin = "round";
          tempCtx.lineWidth = stroke.size;
          
          if (stroke.tool === "eraser") {
            tempCtx.globalCompositeOperation = "destination-out";
            tempCtx.strokeStyle = "rgba(0,0,0,1)";
          } else {
            tempCtx.globalCompositeOperation = "source-over";
            tempCtx.strokeStyle = stroke.color;
          }
          
          tempCtx.beginPath();
          tempCtx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length; i++) {
            tempCtx.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
          tempCtx.stroke();
        }
        
        // Convertir a PNG dataURL
        pageImages[pageNumStr] = tempCanvas.toDataURL("image/png");
      }

      toast.loading("Enviando al servidor...", { id: toastId });

      const requestBody = {
        storageBucket,
        storagePath,
        pdfUrl: !storagePath ? pdfUrl : undefined,
        fileName,
        submissionId,
        pageImages,
      };

      console.log("Sending to Edge Function:", { 
        fileName, 
        submissionId, 
        pageCount: Object.keys(pageImages).length
      });

      // Llamar a la Edge Function
      const { data, error } = await supabase.functions.invoke("annotate-pdf", {
        body: requestBody,
      });

      console.log("Edge Function response:", { data, error });

      if (error) {
        // Intentar leer el cuerpo de la respuesta para obtener el mensaje de error específico
        let errorMessage = error.message;
        
        if (error.context && error.context instanceof Response) {
          try {
            const responseText = await error.context.text();
            console.error("Edge Function response body:", responseText);
            
            try {
              const responseJson = JSON.parse(responseText);
              if (responseJson.error) {
                errorMessage = responseJson.error;
              }
              console.error("Edge Function error JSON:", responseJson);
            } catch (e) {
              console.error("Could not parse error as JSON");
            }
          } catch (e) {
            console.error("Could not read response body:", e);
          }
        }
        
        console.error("Edge Function error details:", {
          message: error.message,
          name: error.name,
          errorMessage,
          data
        });
        
        throw new Error(`Edge Function error: ${errorMessage}`);
      }

      if (!data) {
        throw new Error("No data returned from Edge Function");
      }

      if (!data.success) {
        throw new Error(data.error || "Error desconocido al procesar PDF");
      }

      const sizeMB = (data.fileSize / (1024 * 1024)).toFixed(2);
      toast.success(
        `✅ PDF guardado exitosamente con ${data.annotatedCount} página(s) anotada(s) (${sizeMB}MB). El alumno puede verlo ahora.`,
        { 
          id: toastId,
          duration: 5000 
        }
      );

      // NO limpiar las anotaciones - el profesor puede seguir viéndolas y editando
      // Las anotaciones se mantienen en pageStrokes para que el profesor pueda continuar editando
      
      if (onSaved) onSaved();
    } catch (err: any) {
      console.error("Save PDF error:", err);
      toast.error(`❌ Error al guardar: ${err?.message || "Error desconocido"}`, {
        id: toastId,
        duration: 7000,
      });
    }
  };
    
  

  if (loading) {
    return <div className="py-10 text-center text-muted-foreground">Cargando PDF…</div>;
  }

  if (!pdfDocJs) {
    return <div className="py-10 text-center text-muted-foreground">No se pudo abrir el PDF.</div>;
  }

  return (
    <div className="w-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-3 border rounded mb-3 bg-background">
        <Button variant={tool === "pen" ? "default" : "outline"} onClick={() => setTool("pen")}>
          Lápiz
        </Button>
        <Button variant={tool === "eraser" ? "default" : "outline"} onClick={() => setTool("eraser")}>
          Borrador
        </Button>

        <div className="flex items-center gap-2 ml-2">
          <span className="text-sm">Grosor</span>
          <input
            type="range"
            min={1}
            max={16}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          />
          <span className="text-sm">{size}px</span>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <span className="text-sm">Color</span>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" onClick={goPrev}>
            ← Página
          </Button>
          <span className="text-sm font-medium">
            {pageNum}/{pageCount}
          </span>
          <Button variant="outline" onClick={goNext}>
            Página →
          </Button>
        </div>

        <Button className="bg-gradient-primary" onClick={savePdfComplete}>
          Guardar (PDF completo)
        </Button>

        <Button variant="outline" onClick={clearOverlay}>
          Limpiar
        </Button>

        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        )}
      </div>

      {/* Viewer */}
      <div className="relative w-full overflow-auto border rounded bg-muted/10">
        <canvas ref={baseCanvasRef} className="block mx-auto" />
        <canvas
          ref={overlayCanvasRef}
          className="absolute left-1/2 top-0 -translate-x-1/2"
          style={{ touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        Flujo: el profe anota → “Guardar (PDF completo)” → se sube al Storage y queda asociado a la entrega para que el alumno lo vea luego.
      </p>
    </div>
  );
}

