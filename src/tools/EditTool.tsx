import React, { useState, useRef, useEffect } from 'react';
import {
  PenTool,
  Type,
  FileSignature,
  Image,
  Undo2,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  AlertCircle,
  X,
  Check,
} from 'lucide-react';
import { Dropzone } from '../components/Dropzone';
import { SuccessView } from '../components/SuccessView';
import {
  getPdfJsDocument,
  applyAnnotationsToPdf,
  downloadBlob,
} from '../utils/pdfUtils';
import type { Annotation, TextAnnotation, DrawAnnotation, ImageAnnotation } from '../types';

interface EditToolProps {
  onHome: () => void;
}

export const EditTool: React.FC<EditToolProps> = ({ onHome }) => {
  const [file, setFile] = useState<File | null>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultData, setResultData] = useState<Uint8Array | null>(null);

  // Active Tool Mode in Editor
  const [activeMode, setActiveMode] = useState<'select' | 'text' | 'draw'>('select');
  const [penColor, setPenColor] = useState<string>('#e5322d');
  const [penWidth, setPenWidth] = useState<number>(3);
  const textColor = '#1e293b';
  const [textSize, setTextSize] = useState<number>(16);

  // Annotations list
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  // Signature modal
  const [showSignModal, setShowSignModal] = useState(false);

  // Canvas & Overlay references
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const signaturePadCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Drawing state
  const isDrawingRef = useRef(false);
  const currentDrawPointsRef = useRef<{ x: number; y: number }[]>([]);
  const [liveDrawPoints, setLiveDrawPoints] = useState<{ x: number; y: number }[]>([]);

  // Load PDF document and initial page
  const handleFileSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
    setFile(f);
    setErrorMsg(null);
    setIsLoadingPdf(true);

    try {
      const buffer = await f.arrayBuffer();
      setArrayBuffer(buffer);
      const pdfJsDoc = await getPdfJsDocument(buffer);
      setTotalPages(pdfJsDoc.numPages);
      setCurrentPage(1);
      setAnnotations([]);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('No se pudo cargar el archivo PDF.');
    } finally {
      setIsLoadingPdf(false);
    }
  };

  // Render current page to canvas
  useEffect(() => {
    if (!arrayBuffer || !canvasRef.current) return;

    let isCancelled = false;

    const renderPage = async () => {
      try {
        const pdfJsDoc = await getPdfJsDocument(arrayBuffer);
        const page = await pdfJsDoc.getPage(currentPage);
        const canvas = canvasRef.current;
        if (!canvas || isCancelled) return;

        // Render at crisp 2x scale for sharp text and retina display
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvasContext: ctx,
          viewport: viewport,
        }).promise;
      } catch (err) {
        console.error('Error rendering page:', err);
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
    };
  }, [arrayBuffer, currentPage]);

  // Handle overlay click to insert text
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeMode !== 'text' || !overlayRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    const newTextAnn: TextAnnotation = {
      id: Math.random().toString(36).substring(2, 9),
      pageIndex: currentPage - 1,
      type: 'text',
      x: Math.max(0, Math.min(95, xPct)),
      y: Math.max(0, Math.min(95, yPct)),
      text: 'Texto editable',
      fontSize: textSize,
      color: textColor,
    };

    setAnnotations((prev) => [...prev, newTextAnn]);
    setSelectedAnnotationId(newTextAnn.id);
    setActiveMode('select');
  };

  // Freehand drawing handlers on overlay
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeMode !== 'draw' || !overlayRef.current) return;

    isDrawingRef.current = true;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    currentDrawPointsRef.current = [{ x, y }];
    setLiveDrawPoints([{ x, y }]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawingRef.current || activeMode !== 'draw' || !overlayRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    currentDrawPointsRef.current.push({ x, y });
    setLiveDrawPoints((prev) => [...prev, { x, y }]);
  };

  const handleMouseUp = () => {
    if (!isDrawingRef.current || activeMode !== 'draw') return;
    isDrawingRef.current = false;

    if (currentDrawPointsRef.current.length > 1) {
      const newDrawAnn: DrawAnnotation = {
        id: Math.random().toString(36).substring(2, 9),
        pageIndex: currentPage - 1,
        type: 'draw',
        x: currentDrawPointsRef.current[0].x,
        y: currentDrawPointsRef.current[0].y,
        points: [...currentDrawPointsRef.current],
        color: penColor,
        strokeWidth: penWidth,
      };
      setAnnotations((prev) => [...prev, newDrawAnn]);
    }
    currentDrawPointsRef.current = [];
    setLiveDrawPoints([]);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (activeMode !== 'draw' || !overlayRef.current || e.touches.length === 0) return;
    const touch = e.touches[0];
    isDrawingRef.current = true;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = ((touch.clientX - rect.left) / rect.width) * 100;
    const y = ((touch.clientY - rect.top) / rect.height) * 100;
    currentDrawPointsRef.current = [{ x, y }];
    setLiveDrawPoints([{ x, y }]);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDrawingRef.current || activeMode !== 'draw' || !overlayRef.current || e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = overlayRef.current.getBoundingClientRect();
    const x = ((touch.clientX - rect.left) / rect.width) * 100;
    const y = ((touch.clientY - rect.top) / rect.height) * 100;
    currentDrawPointsRef.current.push({ x, y });
    setLiveDrawPoints((prev) => [...prev, { x, y }]);
  };

  // Image insertion (Stamp / Photo)
  const handleInsertImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const imgFile = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const newImgAnn: ImageAnnotation = {
        id: Math.random().toString(36).substring(2, 9),
        pageIndex: currentPage - 1,
        type: 'image',
        x: 40,
        y: 40,
        dataUrl,
        width: 150,
        height: 80,
      };
      setAnnotations((prev) => [...prev, newImgAnn]);
      setSelectedAnnotationId(newImgAnn.id);
    };

    reader.readAsDataURL(imgFile);
    e.target.value = '';
  };

  // Signature Pad drawing logic
  const isPadDrawingRef = useRef(false);
  const handlePadMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = signaturePadCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isPadDrawingRef.current = true;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handlePadMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPadDrawingRef.current) return;
    const canvas = signaturePadCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const handlePadMouseUp = () => {
    isPadDrawingRef.current = false;
  };

  const handleSaveSignature = () => {
    const canvas = signaturePadCanvasRef.current;
    if (!canvas) return;

    const signatureDataUrl = canvas.toDataURL('image/png');
    const newImgAnn: ImageAnnotation = {
      id: Math.random().toString(36).substring(2, 9),
      pageIndex: currentPage - 1,
      type: 'image',
      x: 35,
      y: 65,
      dataUrl: signatureDataUrl,
      width: 160,
      height: 70,
    };

    setAnnotations((prev) => [...prev, newImgAnn]);
    setSelectedAnnotationId(newImgAnn.id);
    setShowSignModal(false);
  };

  const clearSignaturePad = () => {
    const canvas = signaturePadCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const removeAnnotation = (id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    if (selectedAnnotationId === id) setSelectedAnnotationId(null);
  };

  const updateTextAnnotation = (id: string, text: string) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id && a.type === 'text' ? { ...a, text } : a))
    );
  };

  // Export edited PDF
  const handleExport = async () => {
    if (!arrayBuffer || !file) return;

    setIsExporting(true);
    setErrorMsg(null);

    try {
      const freshBuffer = await file.arrayBuffer();
      const output = await applyAnnotationsToPdf(freshBuffer, annotations);
      setResultData(output);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Error al guardar los cambios en el PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = () => {
    if (!resultData || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    downloadBlob(resultData, `${baseName}_editado.pdf`);
  };

  const handleReset = () => {
    setFile(null);
    setArrayBuffer(null);
    setAnnotations([]);
    setResultData(null);
    setErrorMsg(null);
  };

  if (resultData) {
    return (
      <SuccessView
        title="¡Tu PDF ha sido editado con éxito!"
        subtitle="Todos los textos, firmas y trazos han sido incorporados en el documento."
        onDownload={handleDownload}
        onReset={handleReset}
        onHome={onHome}
        downloadLabel="Descargar PDF Editado"
      />
    );
  }

  const currentAnnotations = annotations.filter((a) => a.pageIndex === currentPage - 1);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Title */}
      <div className="text-center max-w-2xl mx-auto mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 mb-3 shadow-inner">
          <PenTool className="w-7 h-7" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Editar archivo PDF
        </h1>
        <p className="text-slate-500 mt-2 text-base">
          Añade texto, firmas dibujadas, anotaciones e imágenes directamente sobre tus páginas.
        </p>
      </div>

      {!file ? (
        <Dropzone
          onFilesSelected={handleFileSelected}
          multiple={false}
          title="Seleccionar archivo PDF"
          subtitle="o arrastra un PDF aquí para comenzar a editarlo"
        />
      ) : isLoadingPdf ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-sm">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800">Cargando editor de PDF...</h3>
          <p className="text-slate-400 text-sm mt-1">Preparando herramientas de dibujo y texto</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Main Editing Toolbar */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            {/* Tool Mode Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveMode('select')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeMode === 'select'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Modo selección y movimiento"
              >
                <span>Seleccionar</span>
              </button>

              <button
                onClick={() => setActiveMode('text')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeMode === 'text'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Haz clic en cualquier lugar del documento para añadir texto"
              >
                <Type className="w-4 h-4" />
                <span>Añadir Texto</span>
              </button>

              <button
                onClick={() => setActiveMode('draw')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeMode === 'draw'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Dibuja a mano alzada con el lápiz"
              >
                <PenTool className="w-4 h-4" />
                <span>Dibujar / Lápiz</span>
              </button>

              <button
                onClick={() => setShowSignModal(true)}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Dibuja o añade tu firma"
              >
                <FileSignature className="w-4 h-4 text-brand-600" />
                <span>Añadir Firma</span>
              </button>

              <label className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer">
                <Image className="w-4 h-4 text-emerald-600" />
                <span>Insertar Imagen</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleInsertImage}
                  className="hidden"
                />
              </label>
            </div>

            {/* Colors & Pen options */}
            <div className="flex items-center gap-3">
              {activeMode === 'draw' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Color:</span>
                  {['#e5322d', '#2563eb', '#16a34a', '#000000'].map((color) => (
                    <button
                      key={color}
                      onClick={() => setPenColor(color)}
                      style={{ backgroundColor: color }}
                      className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                        penColor === color ? 'scale-125 ring-2 ring-offset-1 ring-blue-500' : 'hover:scale-110'
                      }`}
                    />
                  ))}
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={penWidth}
                    onChange={(e) => setPenWidth(Number(e.target.value))}
                    className="w-16 accent-blue-600 cursor-pointer"
                    title={`Grosor: ${penWidth}px`}
                  />
                </div>
              )}

              {activeMode === 'text' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Tamaño:</span>
                  <select
                    value={textSize}
                    onChange={(e) => setTextSize(Number(e.target.value))}
                    className="text-xs bg-slate-100 border border-slate-200 rounded-lg px-2 py-1"
                  >
                    <option value={12}>12 px</option>
                    <option value={14}>14 px</option>
                    <option value={16}>16 px</option>
                    <option value={20}>20 px</option>
                    <option value={26}>26 px</option>
                    <option value={32}>32 px</option>
                  </select>
                </div>
              )}

              {/* Undo / Clear annotations on this page */}
              {currentAnnotations.length > 0 && (
                <button
                  onClick={() => {
                    const last = currentAnnotations[currentAnnotations.length - 1];
                    if (last) removeAnnotation(last.id);
                  }}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                  title="Deshacer último elemento de esta página"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Page navigation */}
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>
                Pág. {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interactive Document View */}
          <div className="relative flex justify-center bg-slate-200/70 p-6 rounded-3xl min-h-[500px] overflow-auto border border-slate-300">
            <div className="relative shadow-2xl bg-white rounded-lg select-none">
              {/* PDF Background Render */}
              <canvas ref={canvasRef} className="block max-w-full h-auto rounded-lg" />

              {/* Annotation & Interaction Overlay */}
              <div
                ref={overlayRef}
                onClick={handleOverlayClick}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleMouseUp}
                className={`absolute inset-0 z-10 ${
                  activeMode === 'text'
                    ? 'cursor-text'
                    : activeMode === 'draw'
                    ? 'cursor-crosshair'
                    : 'cursor-default'
                }`}
              >
                {/* SVG for freehand drawing strokes */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {currentAnnotations
                    .filter((a): a is DrawAnnotation => a.type === 'draw')
                    .map((d) => (
                      <polyline
                        key={d.id}
                        points={d.points.map((pt) => `${pt.x}%,${pt.y}%`).join(' ')}
                        fill="none"
                        stroke={d.color}
                        strokeWidth={d.strokeWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
                  {/* Real-time active drawing stroke preview */}
                  {liveDrawPoints.length > 1 && (
                    <polyline
                      points={liveDrawPoints.map((pt) => `${pt.x}%,${pt.y}%`).join(' ')}
                      fill="none"
                      stroke={penColor}
                      strokeWidth={penWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </svg>

                {/* Render Text Annotations */}
                {currentAnnotations
                  .filter((a): a is TextAnnotation => a.type === 'text')
                  .map((t) => (
                    <div
                      key={t.id}
                      style={{
                        left: `${t.x}%`,
                        top: `${t.y}%`,
                        fontSize: `${t.fontSize}px`,
                        color: t.color,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnotationId(t.id);
                      }}
                      className={`absolute group z-20 ${
                        selectedAnnotationId === t.id ? 'ring-2 ring-blue-500 rounded' : ''
                      }`}
                    >
                      <input
                        type="text"
                        value={t.text}
                        onChange={(e) => updateTextAnnotation(t.id, e.target.value)}
                        className="bg-transparent border border-dashed border-transparent hover:border-blue-400 focus:border-blue-500 focus:bg-white/80 rounded px-1 outline-none"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAnnotation(t.id);
                        }}
                        className="absolute -top-3 -right-3 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm cursor-pointer"
                        title="Eliminar texto"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                {/* Render Image Annotations (Signatures, Stamps) */}
                {currentAnnotations
                  .filter((a): a is ImageAnnotation => a.type === 'image')
                  .map((img) => (
                    <div
                      key={img.id}
                      style={{
                        left: `${img.x}%`,
                        top: `${img.y}%`,
                        width: `${img.width}px`,
                        height: `${img.height}px`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnotationId(img.id);
                      }}
                      className={`absolute group z-20 border rounded-lg p-1 ${
                        selectedAnnotationId === img.id
                          ? 'border-blue-500 ring-2 ring-blue-400'
                          : 'border-transparent hover:border-blue-400'
                      }`}
                    >
                      <img
                        src={img.dataUrl}
                        alt="Anotación"
                        className="w-full h-full object-contain pointer-events-none"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAnnotation(img.id);
                        }}
                        className="absolute -top-3 -right-3 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm cursor-pointer"
                        title="Eliminar elemento"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 border border-red-200 rounded-2xl text-sm font-semibold">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Sticky action bar */}
          <div className="sticky bottom-6 z-20 flex items-center justify-between gap-4 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-lg">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{file.name}</span>
              <span>•</span>
              <span>{annotations.length} modificaciones agregadas</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl transition-colors cursor-pointer"
              >
                Cambiar archivo
              </button>

              <button
                onClick={handleExport}
                disabled={isExporting}
                className="inline-flex items-center gap-2 px-8 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-base rounded-xl shadow-lg shadow-brand-600/30 transition-[background-color,box-shadow] cursor-pointer disabled:bg-slate-300"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Guardando cambios...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>Descargar PDF Editado</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      {showSignModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-brand-600" />
                <h3 className="font-bold text-slate-900 text-lg">Dibuja tu firma</h3>
              </div>
              <button
                onClick={() => setShowSignModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              Usa el ratón o el dedo táctil para dibujar tu rúbrica en el área inferior.
            </p>

            <div className="border-2 border-dashed border-slate-300 rounded-2xl overflow-hidden bg-slate-50 flex items-center justify-center relative">
              <canvas
                ref={signaturePadCanvasRef}
                width={440}
                height={180}
                onMouseDown={handlePadMouseDown}
                onMouseMove={handlePadMouseMove}
                onMouseUp={handlePadMouseUp}
                className="cursor-crosshair bg-white"
              />
              <span className="absolute bottom-2 left-4 text-[10px] text-slate-400 font-mono pointer-events-none">
                Área de firma transparente
              </span>
            </div>

            <div className="flex items-center justify-between mt-5">
              <button
                type="button"
                onClick={clearSignaturePad}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-red-600 rounded-xl transition-colors cursor-pointer"
              >
                Limpiar trazo
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSignModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveSignature}
                  className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  Insertar en PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
