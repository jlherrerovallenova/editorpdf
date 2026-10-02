import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  GitCompare,
  FileCheck,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sliders,
  Columns,
  Layers,
  Loader2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { renderPdfPageToDataUrl, getPdfJsDocument } from '../utils/pdfUtils';

interface CompareToolProps {
  onHome: () => void;
}

type ViewMode = 'slider' | 'side-by-side' | 'blend';

export const CompareTool: React.FC<CompareToolProps> = ({ onHome: _onHome }) => {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);

  const [page1DataUrl, setPage1DataUrl] = useState<string | null>(null);
  const [page2DataUrl, setPage2DataUrl] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages1, setTotalPages1] = useState<number>(1);
  const [totalPages2, setTotalPages2] = useState<number>(1);

  const [viewMode, setViewMode] = useState<ViewMode>('slider');
  const [sliderPos, setSliderPos] = useState<number>(50); // percentage 0-100
  const isDraggingRef = useRef<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Render pages when file1, file2, or currentPage changes
  const renderCurrentPages = useCallback(async () => {
    if (!file1 || !file2) return;

    setIsRendering(true);
    setErrorMsg(null);

    try {
      const [buffer1, buffer2] = await Promise.all([
        file1.arrayBuffer(),
        file2.arrayBuffer(),
      ]);

      const [pdfDoc1, pdfDoc2] = await Promise.all([
        getPdfJsDocument(buffer1),
        getPdfJsDocument(buffer2),
      ]);

      setTotalPages1(pdfDoc1.numPages);
      setTotalPages2(pdfDoc2.numPages);

      const render1Promise =
        currentPage <= pdfDoc1.numPages
          ? renderPdfPageToDataUrl(buffer1, currentPage, 1.5)
          : Promise.resolve({ dataUrl: '' });

      const render2Promise =
        currentPage <= pdfDoc2.numPages
          ? renderPdfPageToDataUrl(buffer2, currentPage, 1.5)
          : Promise.resolve({ dataUrl: '' });

      const [res1, res2] = await Promise.all([render1Promise, render2Promise]);

      setPage1DataUrl(res1.dataUrl);
      setPage2DataUrl(res2.dataUrl);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Error al procesar las páginas de los PDFs.');
    } finally {
      setIsRendering(false);
    }
  }, [file1, file2, currentPage]);

  useEffect(() => {
    if (file1 && file2) {
      renderCurrentPages();
    }
  }, [file1, file2, currentPage, renderCurrentPages]);

  // Handle Dragging for Split Slider
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  };

  const maxPages = Math.max(totalPages1, totalPages2);

  const handleReset = () => {
    setFile1(null);
    setFile2(null);
    setPage1DataUrl(null);
    setPage2DataUrl(null);
    setCurrentPage(1);
    setSliderPos(50);
    setErrorMsg(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Title */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-100 text-violet-600 mb-3 shadow-inner">
          <GitCompare className="w-7 h-7" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Comparador Visual de PDFs
        </h1>
        <p className="text-slate-500 mt-2 text-base max-w-xl mx-auto">
          Compara dos versiones de un documento con deslizador interactivo antes/después o vista lado a lado.
        </p>
      </div>

      {(!file1 || !file2) ? (
        /* File selection screen: 2 boxes */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* File 1: Original */}
          <div className="bg-white rounded-3xl p-6 border-2 border-dashed border-slate-200 hover:border-violet-400 transition-colors flex flex-col items-center justify-center text-center min-h-[260px] relative">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mb-3">
              <FileText className="w-7 h-7" />
            </div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-violet-600 mb-1">
              Documento 1 (Original)
            </span>
            {file1 ? (
              <div className="mt-2 text-center">
                <p className="font-bold text-slate-900 text-sm truncate max-w-xs">{file1.name}</p>
                <button
                  onClick={() => setFile1(null)}
                  className="mt-2 text-xs font-semibold text-red-500 hover:text-red-700 cursor-pointer"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-slate-700">Arrastra el primer PDF aquí</p>
                <label className="mt-3 inline-block px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-colors">
                  Examinar archivo
                  <input
                    type="file"
                    accept="application/pdf"
                    aria-label="Seleccionar Documento 1 (Original)"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && setFile1(e.target.files[0])}
                  />
                </label>
              </div>
            )}
          </div>

          {/* File 2: Revised */}
          <div className="bg-white rounded-3xl p-6 border-2 border-dashed border-slate-200 hover:border-brand-400 transition-colors flex flex-col items-center justify-center text-center min-h-[260px] relative">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-3">
              <FileCheck className="w-7 h-7" />
            </div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-brand-600 mb-1">
              Documento 2 (Revisado / Nuevo)
            </span>
            {file2 ? (
              <div className="mt-2 text-center">
                <p className="font-bold text-slate-900 text-sm truncate max-w-xs">{file2.name}</p>
                <button
                  onClick={() => setFile2(null)}
                  className="mt-2 text-xs font-semibold text-red-500 hover:text-red-700 cursor-pointer"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-slate-700">Arrastra el segundo PDF aquí</p>
                <label className="mt-3 inline-block px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-colors">
                  Examinar archivo
                  <input
                    type="file"
                    accept="application/pdf"
                    aria-label="Seleccionar Documento 2 (Revisado / Nuevo)"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && setFile2(e.target.files[0])}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Comparison Viewport */
        <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4">
          {/* Top Bar with Mode Switcher & Page Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            {/* View Mode Buttons */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl">
              <button
                onClick={() => setViewMode('slider')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                  viewMode === 'slider' ? 'bg-white text-violet-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Deslizador Divisor</span>
              </button>

              <button
                onClick={() => setViewMode('side-by-side')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                  viewMode === 'side-by-side'
                    ? 'bg-white text-violet-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Lado a Lado</span>
              </button>

              <button
                onClick={() => setViewMode('blend')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                  viewMode === 'blend' ? 'bg-white text-violet-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Diferencias (Fusión)</span>
              </button>
            </div>

            {/* Page Navigation */}
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1 || isRendering}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="Página anterior"
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 text-slate-700" />
              </button>

              <span className="text-xs font-bold text-slate-700 px-2">
                Página {currentPage} de {maxPages}
              </span>

              <button
                disabled={currentPage >= maxPages || isRendering}
                onClick={() => setCurrentPage((p) => Math.min(maxPages, p + 1))}
                aria-label="Página siguiente"
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 text-slate-700" />
              </button>
            </div>

            {/* Zoom Controls & Reset */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoomLevel((z) => Math.max(60, z - 15))}
                aria-label="Reducir zoom"
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-600 w-10 text-center">
                {zoomLevel}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(160, z + 15))}
                aria-label="Aumentar zoom"
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                onClick={handleReset}
                title="Cambiar archivos"
                className="p-2 ml-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Warning if page counts differ */}
          {totalPages1 !== totalPages2 && (
            <div className="p-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                Atención: Los documentos tienen diferente número de páginas (Doc 1: {totalPages1} págs, Doc 2: {totalPages2} págs).
              </span>
            </div>
          )}

          {/* Comparison Display Canvas Area */}
          <div className="relative min-h-[480px] bg-slate-100 rounded-2xl flex items-center justify-center p-4 overflow-auto">
            {isRendering ? (
              <div className="flex flex-col items-center gap-3 text-slate-500 py-12">
                <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
                <span className="text-sm font-semibold">Cargando y alineando páginas...</span>
              </div>
            ) : errorMsg ? (
              <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-2xl text-sm font-semibold">
                {errorMsg}
              </div>
            ) : (
              <div
                style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                className="transition-transform duration-150"
              >
                {/* 1. SLIDER MODE */}
                {viewMode === 'slider' && (
                  <div
                    ref={containerRef}
                    onPointerDown={() => {
                      isDraggingRef.current = true;
                    }}
                    onPointerUp={() => {
                      isDraggingRef.current = false;
                    }}
                    onPointerLeave={() => {
                      isDraggingRef.current = false;
                    }}
                    onPointerMove={handlePointerMove}
                    className="relative select-none shadow-2xl rounded-lg overflow-hidden bg-white max-w-full cursor-ew-resize"
                  >
                    {/* Background: Document 2 (Revised) */}
                    {page2DataUrl ? (
                      <img
                        src={page2DataUrl}
                        alt="Documento 2"
                        className="block max-h-[700px] w-auto pointer-events-none"
                      />
                    ) : (
                      <div className="w-[500px] h-[700px] flex items-center justify-center text-slate-400">
                        Página inexistente en Doc 2
                      </div>
                    )}

                    {/* Foreground / Cutout: Document 1 (Original) */}
                    <div
                      className="absolute inset-y-0 left-0 overflow-hidden pointer-events-none"
                      style={{ width: `${sliderPos}%` }}
                    >
                      {page1DataUrl ? (
                        <img
                          src={page1DataUrl}
                          alt="Documento 1"
                          className="max-h-[700px] w-auto max-w-none block pointer-events-none"
                        />
                      ) : (
                        <div className="w-[500px] h-[700px] flex items-center justify-center text-slate-400">
                          Página inexistente en Doc 1
                        </div>
                      )}
                    </div>

                    {/* Divider Line */}
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-violet-600 shadow-[0_0_10px_rgba(0,0,0,0.3)] pointer-events-none"
                      style={{ left: `${sliderPos}%` }}
                    >
                      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center shadow-lg border-2 border-white pointer-events-none">
                        <Sliders className="w-4 h-4 rotate-90" />
                      </div>
                    </div>

                    {/* Labels indicator */}
                    <div className="absolute top-3 left-3 px-2 py-1 bg-slate-900/80 text-white rounded text-[11px] font-bold pointer-events-none">
                      Doc 1: Original
                    </div>
                    <div className="absolute top-3 right-3 px-2 py-1 bg-violet-700/90 text-white rounded text-[11px] font-bold pointer-events-none">
                      Doc 2: Revisado
                    </div>
                  </div>
                )}

                {/* 2. SIDE BY SIDE MODE */}
                {viewMode === 'side-by-side' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 select-none max-w-5xl">
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-bold text-slate-600 mb-2 px-3 py-1 bg-slate-200 rounded-full">
                        Doc 1 (Original): {file1.name}
                      </span>
                      <div className="bg-white rounded-lg shadow-xl overflow-hidden border border-slate-200">
                        {page1DataUrl ? (
                          <img
                            src={page1DataUrl}
                            alt="Doc 1 Original"
                            className="max-h-[650px] w-auto block"
                          />
                        ) : (
                          <div className="w-[380px] h-[550px] flex items-center justify-center text-slate-400">
                            Página no disponible
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-center">
                      <span className="text-xs font-bold text-violet-700 mb-2 px-3 py-1 bg-violet-100 rounded-full">
                        Doc 2 (Revisado): {file2.name}
                      </span>
                      <div className="bg-white rounded-lg shadow-xl overflow-hidden border border-violet-300">
                        {page2DataUrl ? (
                          <img
                            src={page2DataUrl}
                            alt="Doc 2 Revisado"
                            className="max-h-[650px] w-auto block"
                          />
                        ) : (
                          <div className="w-[380px] h-[550px] flex items-center justify-center text-slate-400">
                            Página no disponible
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. BLEND / DIFFERENCE MODE */}
                {viewMode === 'blend' && (
                  <div className="relative select-none shadow-2xl rounded-lg overflow-hidden bg-white max-h-[700px]">
                    {page1DataUrl && (
                      <img
                        src={page1DataUrl}
                        alt="Doc 1 Base"
                        className="block max-h-[700px] w-auto"
                      />
                    )}
                    {page2DataUrl && (
                      <img
                        src={page2DataUrl}
                        alt="Doc 2 Diff"
                        className="absolute inset-0 max-h-[700px] w-auto mix-blend-difference"
                      />
                    )}
                    <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/80 text-white rounded text-[11px] font-bold">
                      Modo Diferencia: Las áreas modificadas se iluminan con contraste
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
