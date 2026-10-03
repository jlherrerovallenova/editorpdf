import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Crop,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Maximize2,
  RefreshCw,
  Loader2,
  AlertCircle,
  FileCheck,
  Check,
  ZoomIn,
  ZoomOut,
  Sliders,
} from 'lucide-react';
import { Dropzone } from '../components/Dropzone';
import { SuccessView } from '../components/SuccessView';
import {
  getPdfJsDocument,
  cropPdf,
  downloadBlob,
  detectPageContentMargins,
  type CropRectPercentages,
} from '../utils/pdfUtils';

interface CropToolProps {
  onHome: () => void;
}

type CropPreset = 'custom' | 'auto' | 'a4-v' | 'a4-h' | 'letter' | 'square';

type DragAction = 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w';

interface DragState {
  action: DragAction;
  startX: number;
  startY: number;
  initialCrop: CropRectPercentages;
}

const PRESETS: { id: CropPreset; label: string; ratio?: number; desc: string }[] = [
  { id: 'custom', label: 'Libre', desc: 'Ajuste manual sin restricción' },
  { id: 'auto', label: 'Auto-márgenes', desc: 'Detecta y recorta bordes en blanco' },
  { id: 'a4-v', label: 'A4 Vertical', ratio: 1 / 1.4142, desc: 'Proporción estándar DIN A4 (1:√2)' },
  { id: 'a4-h', label: 'A4 Horizontal', ratio: 1.4142, desc: 'A4 apaisado' },
  { id: 'letter', label: 'Carta (US)', ratio: 8.5 / 11, desc: 'Formato estándar US Letter' },
  { id: 'square', label: 'Cuadrado (1:1)', ratio: 1, desc: 'Proporción 1:1' },
];

export const CropTool: React.FC<CropToolProps> = ({ onHome }) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.0);
  const [preset, setPreset] = useState<CropPreset>('custom');
  const [targetScope, setTargetScope] = useState<'all' | 'current'>('all');

  // Crop rectangle in percentages (0 to 100)
  const [crop, setCrop] = useState<CropRectPercentages>({
    x: 5,
    y: 5,
    width: 90,
    height: 90,
  });

  const [isRenderingPage, setIsRenderingPage] = useState<boolean>(false);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [progressPct, setProgressPct] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Result state
  const [resultData, setResultData] = useState<Uint8Array | null>(null);
  const [resultStats, setResultStats] = useState<{
    originalSize: number;
    newSize: number;
    pageCount: number;
    croppedPagesCount: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragInfoRef = useRef<DragState | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  // Handle file selection
  const handleFileSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const selected = files[0];
    setFile(selected);
    setErrorMsg(null);
    setResultData(null);
    setResultStats(null);
    setCurrentPage(1);
    setPreset('custom');
    setCrop({ x: 5, y: 5, width: 90, height: 90 });

    try {
      const buffer = await selected.arrayBuffer();
      setFileBuffer(buffer);
      const doc = await getPdfJsDocument(buffer);
      setTotalPages(doc.numPages);
    } catch (err) {
      console.error('Error reading PDF:', err);
      setErrorMsg('No se pudo abrir el documento PDF seleccionado.');
    }
  };

  // Render PDF page to canvas
  const renderCurrentPage = useCallback(async () => {
    if (!fileBuffer || !canvasRef.current) return;

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // ignore cancellation error
      }
      renderTaskRef.current = null;
    }

    setIsRenderingPage(true);
    try {
      const doc = await getPdfJsDocument(fileBuffer);
      const page = await doc.getPage(currentPage);

      // Render at crisp 1.5 * zoom for sharp preview
      const scale = 1.5 * zoom;
      const viewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      const task = page.render({
        canvasContext: ctx,
        viewport,
      });
      renderTaskRef.current = task;

      await task.promise;
      renderTaskRef.current = null;
    } catch (err: unknown) {
      const error = err as { name?: string };
      if (error && error.name !== 'RenderingCancelledException') {
        console.error('Error rendering page:', err);
      }
    } finally {
      setIsRenderingPage(false);
    }
  }, [fileBuffer, currentPage, zoom]);

  useEffect(() => {
    renderCurrentPage();
  }, [renderCurrentPage]);

  // Auto-detect margins
  const handleAutoMargins = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsDetecting(true);
    setPreset('auto');

    // Run slightly deferred so UI shows active state
    setTimeout(() => {
      try {
        const detected = detectPageContentMargins(canvas);
        setCrop(detected);
      } catch (err) {
        console.error('Auto crop detection failed:', err);
      } finally {
        setIsDetecting(false);
      }
    }, 50);
  }, []);

  // Apply preset ratio
  const handleSelectPreset = (p: CropPreset) => {
    setPreset(p);
    if (p === 'auto') {
      handleAutoMargins();
      return;
    }
    if (p === 'custom') {
      return;
    }

    const matched = PRESETS.find((item) => item.id === p);
    if (!matched || !matched.ratio) return;

    const canvas = canvasRef.current;
    const canvasRatio = canvas && canvas.height > 0 ? canvas.width / canvas.height : 0.707;
    const targetRatio = matched.ratio;

    // Calculate crop dimensions maintaining target aspect ratio relative to canvas
    let newWidthPct = 85;
    let newHeightPct = (newWidthPct * canvasRatio) / targetRatio;

    if (newHeightPct > 90) {
      newHeightPct = 85;
      newWidthPct = (newHeightPct * targetRatio) / canvasRatio;
    }

    newWidthPct = Math.min(95, Math.max(10, Math.round(newWidthPct)));
    newHeightPct = Math.min(95, Math.max(10, Math.round(newHeightPct)));

    const newX = Math.round((100 - newWidthPct) / 2);
    const newY = Math.round((100 - newHeightPct) / 2);

    setCrop({
      x: newX,
      y: newY,
      width: newWidthPct,
      height: newHeightPct,
    });
  };

  // Reset to full page with slight inset
  const handleResetCrop = () => {
    setPreset('custom');
    setCrop({ x: 5, y: 5, width: 90, height: 90 });
  };

  // Mouse & Touch interaction for Drag & Resize
  const handleStartDrag = (
    e: React.MouseEvent | React.TouchEvent,
    action: DragAction
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    dragInfoRef.current = {
      action,
      startX: clientX,
      startY: clientY,
      initialCrop: { ...crop },
    };

    const handlePointerMove = (moveEvt: MouseEvent | TouchEvent) => {
      if (!dragInfoRef.current || !containerRef.current) return;

      const curX = 'touches' in moveEvt ? moveEvt.touches[0].clientX : moveEvt.clientX;
      const curY = 'touches' in moveEvt ? moveEvt.touches[0].clientY : moveEvt.clientY;

      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const deltaXPercent = ((curX - dragInfoRef.current.startX) / rect.width) * 100;
      const deltaYPercent = ((curY - dragInfoRef.current.startY) / rect.height) * 100;

      const initial = dragInfoRef.current.initialCrop;
      const act = dragInfoRef.current.action;

      let nextX = initial.x;
      let nextY = initial.y;
      let nextW = initial.width;
      let nextH = initial.height;

      const minSize = 5; // minimum 5%

      if (act === 'move') {
        nextX = Math.max(0, Math.min(100 - initial.width, initial.x + deltaXPercent));
        nextY = Math.max(0, Math.min(100 - initial.height, initial.y + deltaYPercent));
      } else {
        // West edges
        if (act === 'w' || act === 'nw' || act === 'sw') {
          const maxLeft = initial.x + initial.width - minSize;
          nextX = Math.max(0, Math.min(maxLeft, initial.x + deltaXPercent));
          nextW = initial.width - (nextX - initial.x);
        }
        // East edges
        if (act === 'e' || act === 'ne' || act === 'se') {
          const maxRight = 100 - initial.x;
          nextW = Math.max(minSize, Math.min(maxRight, initial.width + deltaXPercent));
        }
        // North edges
        if (act === 'n' || act === 'nw' || act === 'ne') {
          const maxTop = initial.y + initial.height - minSize;
          nextY = Math.max(0, Math.min(maxTop, initial.y + deltaYPercent));
          nextH = initial.height - (nextY - initial.y);
        }
        // South edges
        if (act === 's' || act === 'sw' || act === 'se') {
          const maxBottom = 100 - initial.y;
          nextH = Math.max(minSize, Math.min(maxBottom, initial.height + deltaYPercent));
        }
      }

      setCrop({
        x: Math.round(nextX * 10) / 10,
        y: Math.round(nextY * 10) / 10,
        width: Math.round(nextW * 10) / 10,
        height: Math.round(nextH * 10) / 10,
      });
    };

    const handlePointerUp = () => {
      dragInfoRef.current = null;
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: false });
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);
  };

  // Perform PDF Crop
  const handleExecuteCrop = async () => {
    if (!file || !fileBuffer) return;

    setIsProcessing(true);
    setProgressPct(5);
    setProgressMsg('Iniciando recorte...');
    setErrorMsg(null);

    try {
      const targetPages = targetScope === 'all' ? 'all' : [currentPage];
      const result = await cropPdf(
        fileBuffer,
        {
          crop,
          targetPages,
        },
        (msg, pct) => {
          setProgressMsg(msg);
          setProgressPct(pct);
        }
      );

      setResultData(result.data);
      setResultStats({
        originalSize: file.size,
        newSize: result.data.byteLength,
        pageCount: result.pageCount,
        croppedPagesCount: result.croppedPagesCount,
      });
    } catch (err: unknown) {
      console.error('Error cropping PDF:', err);
      const message = err instanceof Error ? err.message : 'Error inesperado al recortar el documento.';
      setErrorMsg(message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Download handler
  const handleDownload = () => {
    if (!resultData || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    downloadBlob(resultData, `${baseName}_recortado.pdf`);
  };

  // Reset all
  const handleResetAll = () => {
    setFile(null);
    setFileBuffer(null);
    setResultData(null);
    setResultStats(null);
    setErrorMsg(null);
    setCrop({ x: 5, y: 5, width: 90, height: 90 });
    setPreset('custom');
  };

  // If successfully finished, render SuccessView
  if (resultData && resultStats && file) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <SuccessView
          title="¡Documento PDF Recortado con Éxito!"
          subtitle={`Se ha aplicado el recorte a ${
            targetScope === 'all'
              ? `todas las páginas (${resultStats.pageCount})`
              : `la página ${currentPage}`
          } preservando vectores, texto y nitidez.`}
          onDownload={handleDownload}
          onReset={handleResetAll}
          onHome={onHome}
          downloadLabel="Descargar PDF Recortado"
          stats={{
            originalSize: resultStats.originalSize,
            newSize: resultStats.newSize,
            pageCount: resultStats.pageCount,
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onHome}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            title="Volver al inicio"
            aria-label="Volver al inicio"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center text-sky-600">
            <Crop className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Recortar PDF</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Ajusta el área visible de tus páginas o elimina márgenes automáticamente
            </p>
          </div>
        </div>

        {file && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetAll}
              className="px-3 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors"
              aria-label="Cambiar archivo PDF"
            >
              Cambiar archivo
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700 text-sm animate-fade-in">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <p className="font-medium">{errorMsg}</p>
        </div>
      )}

      {/* Upload State */}
      {!file && (
        <div className="max-w-3xl mx-auto mt-6">
          <Dropzone
            onFilesSelected={handleFileSelected}
            accept=".pdf,application/pdf"
            maxFiles={1}
            title="Selecciona el archivo PDF a recortar"
            subtitle="Arrastra y suelta tu documento o haz clic para explorar en tu equipo"
          />

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div className="p-4 bg-sky-50/60 rounded-2xl border border-sky-100 text-center">
              <div className="w-10 h-10 bg-sky-100 text-sky-600 rounded-xl flex items-center justify-center mx-auto mb-2">
                <Sparkles className="w-5 h-5" />
              </div>
              <h2 className="font-semibold text-slate-800 text-sm">Recorte Inteligente</h2>
              <p className="text-xs text-slate-500 mt-1">
                Detecta y recorta bordes blancos en un solo clic con precisión milimétrica.
              </p>
            </div>

            <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100 text-center">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-2">
                <Crop className="w-5 h-5" />
              </div>
              <h2 className="font-semibold text-slate-800 text-sm">Proporciones Exactas</h2>
              <p className="text-xs text-slate-500 mt-1">
                Ajusta a proporciones A4, Carta o libres manteniendo texto vectorial nítido.
              </p>
            </div>

            <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 text-center">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-2">
                <FileCheck className="w-5 h-5" />
              </div>
              <h2 className="font-semibold text-slate-800 text-sm">Por Lote o Individual</h2>
              <p className="text-xs text-slate-500 mt-1">
                Aplica las mismas medidas a todo el libro o documento de una sola vez.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Workspace when file is loaded */}
      {file && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Interactive Canvas Area (8 cols) */}
          <div className="lg:col-span-8 flex flex-col bg-slate-900/95 rounded-3xl p-4 sm:p-6 shadow-xl border border-slate-800 text-white min-h-[580px]">
            {/* Canvas Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
              {/* Page Navigator */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || isRenderingPage}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-200" />
                </button>

                <span className="text-xs font-medium text-slate-300 px-1">
                  Pág. <strong className="text-white">{currentPage}</strong> de {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages || isRenderingPage}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="w-4 h-4 text-slate-200" />
                </button>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  aria-label="Reducir zoom"
                  title="Reducir zoom"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono text-slate-300 w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(1.8, z + 0.15))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  aria-label="Aumentar zoom"
                  title="Aumentar zoom"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1.0)}
                  className="px-2 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  aria-label="Restablecer zoom a 100%"
                >
                  100%
                </button>
              </div>
            </div>

            {/* Interactive Canvas Viewport */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 min-h-[460px]">
              <div
                ref={containerRef}
                className="relative select-none shadow-2xl rounded-sm bg-white"
                style={{
                  display: 'inline-block',
                }}
              >
                {/* PDF Page Canvas */}
                <canvas ref={canvasRef} className="block max-h-[70vh] w-auto h-auto object-contain" />

                {/* Darkened Mask Over Uncropped Areas using CSS Box-Shadow */}
                <div
                  className="absolute pointer-events-none border-2 border-sky-400"
                  style={{
                    left: `${crop.x}%`,
                    top: `${crop.y}%`,
                    width: `${crop.width}%`,
                    height: `${crop.height}%`,
                    boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.65)',
                  }}
                >
                  {/* Rule of Thirds Guidelines inside Crop Box */}
                  <div className="w-full h-full relative grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                    <div className="border-r border-b border-sky-200/50" />
                    <div className="border-r border-b border-sky-200/50" />
                    <div className="border-b border-sky-200/50" />
                    <div className="border-r border-b border-sky-200/50" />
                    <div className="border-r border-b border-sky-200/50" />
                    <div className="border-b border-sky-200/50" />
                    <div className="border-r border-sky-200/50" />
                    <div className="border-r border-sky-200/50" />
                    <div />
                  </div>
                </div>

                {/* Draggable Active Crop Box Container */}
                <div
                  onMouseDown={(e) => handleStartDrag(e, 'move')}
                  onTouchStart={(e) => handleStartDrag(e, 'move')}
                  className="absolute cursor-move z-10"
                  style={{
                    left: `${crop.x}%`,
                    top: `${crop.y}%`,
                    width: `${crop.width}%`,
                    height: `${crop.height}%`,
                  }}
                  title="Arrastra para mover el recorte"
                >
                  {/* Dimension pill at bottom center */}
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-sky-900/90 text-sky-100 text-[10px] font-mono px-2 py-0.5 rounded-full pointer-events-none shadow backdrop-blur whitespace-nowrap">
                    {Math.round(crop.width)}% × {Math.round(crop.height)}%
                  </div>

                  {/* Corner Handles */}
                  {/* Top-Left NW */}
                  <button
                    type="button"
                    onMouseDown={(e) => handleStartDrag(e, 'nw')}
                    onTouchStart={(e) => handleStartDrag(e, 'nw')}
                    className="absolute -top-2 -left-2 w-4 h-4 bg-sky-500 hover:bg-sky-400 border-2 border-white rounded-full cursor-nwse-resize shadow-md transition-colors"
                    aria-label="Redimensionar esquina superior izquierda"
                  />
                  {/* Top-Right NE */}
                  <button
                    type="button"
                    onMouseDown={(e) => handleStartDrag(e, 'ne')}
                    onTouchStart={(e) => handleStartDrag(e, 'ne')}
                    className="absolute -top-2 -right-2 w-4 h-4 bg-sky-500 hover:bg-sky-400 border-2 border-white rounded-full cursor-nesw-resize shadow-md transition-colors"
                    aria-label="Redimensionar esquina superior derecha"
                  />
                  {/* Bottom-Right SE */}
                  <button
                    type="button"
                    onMouseDown={(e) => handleStartDrag(e, 'se')}
                    onTouchStart={(e) => handleStartDrag(e, 'se')}
                    className="absolute -bottom-2 -right-2 w-4 h-4 bg-sky-500 hover:bg-sky-400 border-2 border-white rounded-full cursor-nwse-resize shadow-md transition-colors"
                    aria-label="Redimensionar esquina inferior derecha"
                  />
                  {/* Bottom-Left SW */}
                  <button
                    type="button"
                    onMouseDown={(e) => handleStartDrag(e, 'sw')}
                    onTouchStart={(e) => handleStartDrag(e, 'sw')}
                    className="absolute -bottom-2 -left-2 w-4 h-4 bg-sky-500 hover:bg-sky-400 border-2 border-white rounded-full cursor-nesw-resize shadow-md transition-colors"
                    aria-label="Redimensionar esquina inferior izquierda"
                  />

                  {/* Edge Handles */}
                  {/* Top N */}
                  <button
                    type="button"
                    onMouseDown={(e) => handleStartDrag(e, 'n')}
                    onTouchStart={(e) => handleStartDrag(e, 'n')}
                    className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-3 bg-white/90 hover:bg-white border border-sky-500 rounded-sm cursor-ns-resize shadow-sm transition-colors"
                    aria-label="Ajustar borde superior"
                  />
                  {/* Bottom S */}
                  <button
                    type="button"
                    onMouseDown={(e) => handleStartDrag(e, 's')}
                    onTouchStart={(e) => handleStartDrag(e, 's')}
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-3 bg-white/90 hover:bg-white border border-sky-500 rounded-sm cursor-ns-resize shadow-sm transition-colors"
                    aria-label="Ajustar borde inferior"
                  />
                  {/* Left W */}
                  <button
                    type="button"
                    onMouseDown={(e) => handleStartDrag(e, 'w')}
                    onTouchStart={(e) => handleStartDrag(e, 'w')}
                    className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-6 bg-white/90 hover:bg-white border border-sky-500 rounded-sm cursor-ew-resize shadow-sm transition-colors"
                    aria-label="Ajustar borde izquierdo"
                  />
                  {/* Right E */}
                  <button
                    type="button"
                    onMouseDown={(e) => handleStartDrag(e, 'e')}
                    onTouchStart={(e) => handleStartDrag(e, 'e')}
                    className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-6 bg-white/90 hover:bg-white border border-sky-500 rounded-sm cursor-ew-resize shadow-sm transition-colors"
                    aria-label="Ajustar borde derecho"
                  />
                </div>

                {/* Loading overlay for page render */}
                {isRenderingPage && (
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {/* Quick Helper text */}
            <div className="text-center pt-2 text-xs text-slate-400">
              💡 Arrastra el centro para mover la selección o tira de los puntos azules para redimensionar.
            </div>
          </div>

          {/* Settings Sidebar (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* Presets Card */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-sky-600" />
                  <h2 className="font-bold text-slate-800 text-sm">Proporción y Presets</h2>
                </div>
                <button
                  type="button"
                  onClick={handleResetCrop}
                  className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
                  aria-label="Restablecer selección"
                >
                  <RefreshCw className="w-3 h-3" />
                  Restablecer
                </button>
              </div>

              {/* Auto margins button */}
              <button
                type="button"
                onClick={handleAutoMargins}
                disabled={isDetecting || isRenderingPage}
                className="w-full mb-4 py-3 px-4 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold text-xs sm:text-sm shadow-md hover:shadow-lg transition-[background-color,box-shadow] flex items-center justify-center gap-2 disabled:opacity-50"
                aria-label="Recorte automático de márgenes en blanco"
              >
                {isDetecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analizando márgenes...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Detectar y recortar márgenes automáticamente
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((p) => {
                  const isSelected = preset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPreset(p.id)}
                      className={`p-3 rounded-2xl border text-left transition-colors ${
                        isSelected
                          ? 'border-sky-500 bg-sky-50 text-sky-900 font-semibold'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                      aria-label={`Seleccionar preset ${p.label}`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span>{p.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-sky-600" />}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 line-clamp-1">{p.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scope & Options Card */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80">
              <h2 className="font-bold text-slate-800 text-sm mb-3">Aplicar Recorte a:</h2>

              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 hover:border-slate-300 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="cropScope"
                    checked={targetScope === 'all'}
                    onChange={() => setTargetScope('all')}
                    className="w-4 h-4 text-sky-600 focus:ring-sky-500"
                    aria-label="Aplicar a todas las páginas"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800 block">Todas las páginas</span>
                    <span className="text-slate-400">
                      Aplica estas mismas coordenadas a las {totalPages} páginas del PDF
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 hover:border-slate-300 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="cropScope"
                    checked={targetScope === 'current'}
                    onChange={() => setTargetScope('current')}
                    className="w-4 h-4 text-sky-600 focus:ring-sky-500"
                    aria-label="Aplicar solo a la página actual"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800 block">
                      Solo página actual (Pág. {currentPage})
                    </span>
                    <span className="text-slate-400">
                      Las demás páginas conservarán sus dimensiones originales
                    </span>
                  </div>
                </label>
              </div>

              {/* Real-time Dimensions Summary */}
              <div className="mt-5 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs">
                <span className="font-semibold text-slate-700 block mb-1">Medidas del recorte:</span>
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <div>
                    Margen Izq: <strong>{crop.x}%</strong>
                  </div>
                  <div>
                    Margen Sup: <strong>{crop.y}%</strong>
                  </div>
                  <div>
                    Ancho: <strong>{crop.width}%</strong>
                  </div>
                  <div>
                    Alto: <strong>{crop.height}%</strong>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200 text-slate-500 text-[11px]">
                  Área conservada: ~{Math.round((crop.width * crop.height) / 100)}% de la página
                </div>
              </div>
            </div>

            {/* Execute Button Card */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80">
              {isProcessing ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                    <span>{progressMsg}</span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 to-blue-600 rounded-full transition-[width] duration-200"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleExecuteCrop}
                  className="w-full py-4 px-6 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-base shadow-lg shadow-sky-500/20 hover:shadow-sky-500/30 transition-[background-color,box-shadow] flex items-center justify-center gap-2"
                  aria-label="Recortar y descargar documento PDF"
                >
                  <Crop className="w-5 h-5" />
                  Recortar PDF Ahora
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
