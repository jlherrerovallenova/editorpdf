import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Trash2,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Info,
  Sliders,
  Sparkles,
  MousePointer,
  FileCheck,
  Check,
} from 'lucide-react';
import { Dropzone } from '../components/Dropzone';
import { SuccessView } from '../components/SuccessView';
import {
  getPdfJsDocument,
  scanPdfForSensitiveData,
  applyAnonymizationToPdf,
  downloadBlob,
  formatFileSize,
  type RedactionItem,
  type AnonymizeOptions,
} from '../utils/pdfUtils';

interface AnonymizeToolProps {
  onHome: () => void;
}

export const AnonymizeTool: React.FC<AnonymizeToolProps> = ({ onHome }) => {
  const [file, setFile] = useState<File | null>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');
  const [progressPct, setProgressPct] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Redactions & Search terms
  const [redactions, setRedactions] = useState<RedactionItem[]>([]);
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);
  const [newKeywordInput, setNewKeywordInput] = useState<string>('');

  // Redaction Options
  const [redactionStyle, setRedactionStyle] = useState<AnonymizeOptions['style']>('black');
  const [removeMetadata, setRemoveMetadata] = useState<boolean>(true);
  const [flattenPdf, setFlattenPdf] = useState<boolean>(true);

  // Result state
  const [resultPdfBytes, setResultPdfBytes] = useState<Uint8Array | null>(null);

  // Canvas & manual selection refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [dragBox, setDragBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Load PDF file and trigger initial automatic scan
  const handleFileSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
    setFile(f);
    setErrorMsg(null);
    setResultPdfBytes(null);
    setIsScanning(true);
    setProgressPct(10);
    setProgressText('Cargando documento PDF...');

    try {
      const buffer = await f.arrayBuffer();
      setArrayBuffer(buffer);

      const pdfJsDoc = await getPdfJsDocument(buffer);
      setTotalPages(pdfJsDoc.numPages);
      setCurrentPage(1);

      setProgressText('Escaneando documento en busca de datos sensibles (DNI, emails, teléfonos, IBAN)...');
      const detected = await scanPdfForSensitiveData(buffer, customKeywords, (text, pct) => {
        setProgressText(text);
        setProgressPct(pct);
      });

      setRedactions(detected);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('No se pudo procesar el archivo PDF. Asegúrate de que no esté protegido con contraseña.');
    } finally {
      setIsScanning(false);
    }
  };

  // Re-scan when custom keywords change
  const handleAddCustomKeyword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const term = newKeywordInput.trim();
    if (!term || customKeywords.includes(term) || !arrayBuffer) return;

    const updatedKeywords = [...customKeywords, term];
    setCustomKeywords(updatedKeywords);
    setNewKeywordInput('');

    setIsScanning(true);
    setProgressText(`Buscando coincidencias de "${term}"...`);
    try {
      const detected = await scanPdfForSensitiveData(arrayBuffer, updatedKeywords);
      // Merge keeping manual redactions and enabled states
      const manualRedactions = redactions.filter((r) => r.category === 'manual');
      const existingEnabledMap = new Map(redactions.map((r) => [r.id, r.enabled]));

      const merged = [
        ...manualRedactions,
        ...detected.map((r) => ({
          ...r,
          enabled: existingEnabledMap.has(r.id) ? (existingEnabledMap.get(r.id) as boolean) : true,
        })),
      ];
      setRedactions(merged);
    } catch (err) {
      console.warn(err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleRemoveCustomKeyword = async (term: string) => {
    const updated = customKeywords.filter((k) => k !== term);
    setCustomKeywords(updated);

    if (!arrayBuffer) return;
    setIsScanning(true);
    try {
      const detected = await scanPdfForSensitiveData(arrayBuffer, updated);
      const manualRedactions = redactions.filter((r) => r.category === 'manual');
      setRedactions([...manualRedactions, ...detected]);
    } catch (err) {
      console.warn(err);
    } finally {
      setIsScanning(false);
    }
  };

  // Toggle category enabled state
  const handleToggleCategory = (category: RedactionItem['category']) => {
    const categoryItems = redactions.filter((r) => r.category === category);
    const areAllEnabled = categoryItems.every((r) => r.enabled);

    setRedactions((prev) =>
      prev.map((r) => (r.category === category ? { ...r, enabled: !areAllEnabled } : r))
    );
  };

  // Toggle single redaction
  const handleToggleRedaction = (id: string) => {
    setRedactions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  // Delete single redaction
  const handleDeleteRedaction = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRedactions((prev) => prev.filter((r) => r.id !== id));
  };

  // Render current page on canvas
  const renderCurrentPage = useCallback(async () => {
    if (!arrayBuffer || !canvasRef.current) return;

    try {
      const pdfJsDoc = await getPdfJsDocument(arrayBuffer);
      const page = await pdfJsDoc.getPage(currentPage);
      const canvas = canvasRef.current;
      if (!canvas) return;

      const viewport = page.getViewport({ scale: 1.5 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch (err) {
      console.error('Error rendering page:', err);
    }
  }, [arrayBuffer, currentPage]);

  useEffect(() => {
    renderCurrentPage();
  }, [renderCurrentPage]);

  // Mouse drag handlers for manual redaction drawing
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    isDraggingRef.current = true;
    dragStartRef.current = { x: xPct, y: yPct };
    setDragBox({ x: xPct, y: yPct, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !dragStartRef.current || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const currentX = ((e.clientX - rect.left) / rect.width) * 100;
    const currentY = ((e.clientY - rect.top) / rect.height) * 100;

    const startX = dragStartRef.current.x;
    const startY = dragStartRef.current.y;

    const boxX = Math.min(startX, currentX);
    const boxY = Math.min(startY, currentY);
    const boxW = Math.abs(currentX - startX);
    const boxH = Math.abs(currentY - startY);

    setDragBox({ x: boxX, y: boxY, width: boxW, height: boxH });
  };

  const handleMouseUp = () => {
    if (!isDraggingRef.current || !dragBox) return;
    isDraggingRef.current = false;
    dragStartRef.current = null;

    // Only add if box has a minimum size (e.g. > 1% width and height)
    if (dragBox.width > 1.2 && dragBox.height > 1.0) {
      const newManualItem: RedactionItem = {
        id: `manual-${currentPage}-${Date.now()}`,
        pageIndex: currentPage - 1,
        x: Math.round(dragBox.x * 100) / 100,
        y: Math.round(dragBox.y * 100) / 100,
        width: Math.round(dragBox.width * 100) / 100,
        height: Math.round(dragBox.height * 100) / 100,
        category: 'manual',
        text: 'Área censurada manualmente',
        enabled: true,
      };
      setRedactions((prev) => [...prev, newManualItem]);
    }

    setDragBox(null);
  };

  // Perform Final Anonymization
  const handleApplyAnonymization = async () => {
    if (!arrayBuffer || !file) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setProgressPct(5);
    setProgressText('Iniciando proceso de anonimización...');

    try {
      const options: AnonymizeOptions = {
        style: redactionStyle,
        textLabel: '[CENSURADO]',
        removeMetadata,
        flattenPdf,
      };

      const result = await applyAnonymizationToPdf(arrayBuffer, redactions, options, (text, pct) => {
        setProgressText(text);
        setProgressPct(pct);
      });

      setResultPdfBytes(result);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Error al aplicar la anonimización.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultPdfBytes || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    downloadBlob(resultPdfBytes, `${baseName}_anonimizado.pdf`);
  };

  const handleReset = () => {
    setFile(null);
    setArrayBuffer(null);
    setTotalPages(0);
    setCurrentPage(1);
    setRedactions([]);
    setCustomKeywords([]);
    setResultPdfBytes(null);
    setErrorMsg(null);
    setProgressPct(0);
    setProgressText('');
  };

  // Redactions counts by category
  const currentPageRedactions = redactions.filter((r) => r.pageIndex === currentPage - 1);
  const activeCount = redactions.filter((r) => r.enabled).length;

  const countCategory = (cat: RedactionItem['category']) =>
    redactions.filter((r) => r.category === cat).length;
  const countCategoryEnabled = (cat: RedactionItem['category']) =>
    redactions.filter((r) => r.category === cat && r.enabled).length;

  if (resultPdfBytes) {
    return (
      <SuccessView
        title="¡Tu documento ha sido anonimizado con éxito!"
        subtitle={`Se han censurado de forma irreversible ${activeCount} elementos sensibles y se han limpiado todos los metadatos privados del archivo.`}
        onDownload={handleDownload}
        onReset={handleReset}
        onHome={onHome}
        downloadLabel="Descargar PDF Anonimizado"
        stats={{
          pageCount: totalPages,
          newSize: resultPdfBytes.byteLength,
        }}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Title Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 mb-3 shadow-inner">
          <EyeOff className="w-7 h-7" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Anonimizar PDF
        </h1>
        <p className="text-slate-500 mt-2 text-base max-w-2xl mx-auto">
          Censura de forma permanente datos personales sensibles (DNI, emails, teléfonos, cuentas bancarias) y elimina metadatos privados cumpliendo con RGPD/LOPD.
        </p>

        {/* Feature Badges */}
        <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Detección automática de DNI/NIE, Emails e IBAN
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            Aplanado irreversible a 300 DPI
          </span>
        </div>
      </div>

      {!file ? (
        <Dropzone
          onFilesSelected={handleFileSelected}
          multiple={false}
          title="Seleccionar documento PDF para anonimizar"
          subtitle="o arrastra tu archivo aquí para detectar y censurar datos confidenciales"
        />
      ) : (
        <div className="space-y-6">
          {/* File summary & actions banner */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                <FileCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate max-w-xs sm:max-w-md">
                  {file.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {totalPages} {totalPages === 1 ? 'página' : 'páginas'} • {formatFileSize(file.size)} •{' '}
                  <span className="font-semibold text-emerald-700">{activeCount} censuras activas</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={handleReset}
                disabled={isProcessing || isScanning}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Cambiar archivo
              </button>
              <button
                onClick={handleApplyAnonymization}
                disabled={isProcessing || isScanning || activeCount === 0}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:bg-slate-300 flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Anonimizando...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Anonimizar ({activeCount}) y Descargar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Progress notification if busy */}
          {(isScanning || isProcessing) && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  {progressText}
                </span>
                <span className="text-emerald-700 font-extrabold">{progressPct}%</span>
              </div>
              <div className="w-full bg-emerald-200/50 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-[width] duration-300 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 border border-red-200 rounded-2xl text-sm font-semibold">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Workspace Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left/Center: Interactive PDF Page Viewer (Col 8) */}
            <div className="lg:col-span-8 bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
              {/* Page Controls Toolbar */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg">
                    <MousePointer className="w-3.5 h-3.5 text-slate-500" />
                    Arrastra el ratón sobre la página para censurar cualquier área
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1 || isProcessing}
                    aria-label="Página anterior"
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-slate-700 px-1">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages || isProcessing}
                    aria-label="Página siguiente"
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Canvas Preview Container with Interactive Overlay */}
              <div className="relative flex justify-center bg-slate-100 rounded-2xl p-4 overflow-auto min-h-[550px]">
                <div
                  ref={overlayRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  className="relative shadow-xl rounded-lg overflow-hidden cursor-crosshair select-none inline-block max-w-full"
                >
                  <canvas ref={canvasRef} className="block max-w-full h-auto" />

                  {/* Render Existing Redactions for current page */}
                  {currentPageRedactions.map((r) => {
                    if (!r.enabled) return null;
                    return (
                      <div
                        key={r.id}
                        onClick={() => handleToggleRedaction(r.id)}
                        title={`${r.text} (${r.category}) - Clic para desactivar`}
                        style={{
                          left: `${r.x}%`,
                          top: `${r.y}%`,
                          width: `${r.width}%`,
                          height: `${r.height}%`,
                        }}
                        className={`absolute group transition-transform ${
                          redactionStyle === 'white'
                            ? 'bg-white border border-slate-300'
                            : redactionStyle === 'text'
                            ? 'bg-slate-900 text-white flex items-center justify-center text-[10px] font-extrabold tracking-widest'
                            : 'bg-black'
                        }`}
                      >
                        {redactionStyle === 'text' && <span>[CENSURADO]</span>}

                        {/* Tooltip & Delete button on hover */}
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-[10px] font-semibold px-2 py-1 rounded shadow-lg whitespace-nowrap z-30 pointer-events-none transition-opacity">
                          {r.text}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteRedaction(r.id, e)}
                          title="Eliminar esta censura"
                          className="opacity-0 group-hover:opacity-100 absolute -top-2 -right-2 w-5 h-5 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center z-40 transition-opacity shadow-md cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Live Dragging Rectangle */}
                  {dragBox && dragBox.width > 0 && dragBox.height > 0 && (
                    <div
                      style={{
                        left: `${dragBox.x}%`,
                        top: `${dragBox.y}%`,
                        width: `${dragBox.width}%`,
                        height: `${dragBox.height}%`,
                      }}
                      className="absolute border-2 border-red-500 bg-red-500/25 pointer-events-none z-20"
                    />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>
                  {currentPageRedactions.filter((r) => r.enabled).length} censuras en esta página
                </span>
                <span className="flex items-center gap-1 text-slate-400">
                  <Info className="w-3.5 h-3.5" />
                  Haz clic sobre cualquier caja para activarla o desactivarla
                </span>
              </div>
            </div>

            {/* Right Side: Detection & Custom Redaction Settings (Col 4) */}
            <div className="lg:col-span-4 space-y-5">
              {/* Category Toggles Box */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <h4 className="font-bold text-slate-900 text-sm">Datos Detectados</h4>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {activeCount} activos
                  </span>
                </div>

                <div className="space-y-2.5">
                  {/* DNI */}
                  <div
                    onClick={() => handleToggleCategory('dni')}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                      countCategory('dni') === 0
                        ? 'border-slate-100 bg-slate-50 opacity-60'
                        : countCategoryEnabled('dni') > 0
                        ? 'border-emerald-300 bg-emerald-50/50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border text-white ${
                          countCategoryEnabled('dni') > 0
                            ? 'bg-emerald-600 border-emerald-600'
                            : 'border-slate-300'
                        }`}
                      >
                        {countCategoryEnabled('dni') > 0 && <Check className="w-3 h-3" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">DNI / NIE / CIF</p>
                        <p className="text-[11px] text-slate-500">Documentos de identidad</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                      {countCategory('dni')}
                    </span>
                  </div>

                  {/* Emails */}
                  <div
                    onClick={() => handleToggleCategory('email')}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                      countCategory('email') === 0
                        ? 'border-slate-100 bg-slate-50 opacity-60'
                        : countCategoryEnabled('email') > 0
                        ? 'border-emerald-300 bg-emerald-50/50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border text-white ${
                          countCategoryEnabled('email') > 0
                            ? 'bg-emerald-600 border-emerald-600'
                            : 'border-slate-300'
                        }`}
                      >
                        {countCategoryEnabled('email') > 0 && <Check className="w-3 h-3" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Correos Electrónicos</p>
                        <p className="text-[11px] text-slate-500">Direcciones de email</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                      {countCategory('email')}
                    </span>
                  </div>

                  {/* Phones */}
                  <div
                    onClick={() => handleToggleCategory('phone')}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                      countCategory('phone') === 0
                        ? 'border-slate-100 bg-slate-50 opacity-60'
                        : countCategoryEnabled('phone') > 0
                        ? 'border-emerald-300 bg-emerald-50/50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border text-white ${
                          countCategoryEnabled('phone') > 0
                            ? 'bg-emerald-600 border-emerald-600'
                            : 'border-slate-300'
                        }`}
                      >
                        {countCategoryEnabled('phone') > 0 && <Check className="w-3 h-3" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Teléfonos</p>
                        <p className="text-[11px] text-slate-500">Móviles y fijos</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                      {countCategory('phone')}
                    </span>
                  </div>

                  {/* IBAN */}
                  <div
                    onClick={() => handleToggleCategory('iban')}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                      countCategory('iban') === 0
                        ? 'border-slate-100 bg-slate-50 opacity-60'
                        : countCategoryEnabled('iban') > 0
                        ? 'border-emerald-300 bg-emerald-50/50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border text-white ${
                          countCategoryEnabled('iban') > 0
                            ? 'bg-emerald-600 border-emerald-600'
                            : 'border-slate-300'
                        }`}
                      >
                        {countCategoryEnabled('iban') > 0 && <Check className="w-3 h-3" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Cuentas IBAN / Tarjetas</p>
                        <p className="text-[11px] text-slate-500">Datos bancarios</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                      {countCategory('iban')}
                    </span>
                  </div>

                  {/* Dates */}
                  <div
                    onClick={() => handleToggleCategory('date')}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                      countCategory('date') === 0
                        ? 'border-slate-100 bg-slate-50 opacity-60'
                        : countCategoryEnabled('date') > 0
                        ? 'border-emerald-300 bg-emerald-50/50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border text-white ${
                          countCategoryEnabled('date') > 0
                            ? 'bg-emerald-600 border-emerald-600'
                            : 'border-slate-300'
                        }`}
                      >
                        {countCategoryEnabled('date') > 0 && <Check className="w-3 h-3" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Fechas</p>
                        <p className="text-[11px] text-slate-500">Fechas de nacimiento y firma</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                      {countCategory('date')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Custom Search Words Box */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-600" />
                  Censurar palabras o nombres clave
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Escribe un nombre, apellido o empresa y se censurará en todas las páginas.
                </p>

                <form onSubmit={handleAddCustomKeyword} className="flex gap-2">
                  <input
                    type="text"
                    value={newKeywordInput}
                    onChange={(e) => setNewKeywordInput(e.target.value)}
                    placeholder="Ej: García, Empresa S.L...."
                    className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!newKeywordInput.trim() || isScanning}
                    className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer"
                  >
                    Añadir
                  </button>
                </form>

                {customKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {customKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                      >
                        <span>{kw}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomKeyword(kw)}
                          className="hover:text-red-600 cursor-pointer text-slate-400"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Redaction Style & Privacy Settings */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-600" />
                  Estilo de Censura y Seguridad
                </h4>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Aspecto de la censura
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setRedactionStyle('black')}
                      className={`p-2.5 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                        redactionStyle === 'black'
                          ? 'border-emerald-600 bg-emerald-50/60 text-emerald-900 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="w-full h-3 bg-black rounded mb-1.5 mx-auto" />
                      Negro
                    </button>

                    <button
                      type="button"
                      onClick={() => setRedactionStyle('text')}
                      className={`p-2.5 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                        redactionStyle === 'text'
                          ? 'border-emerald-600 bg-emerald-50/60 text-emerald-900 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="w-full h-3 bg-slate-900 text-[8px] text-white flex items-center justify-center rounded mb-1.5 mx-auto font-mono">
                        CENSURA
                      </div>
                      Texto
                    </button>

                    <button
                      type="button"
                      onClick={() => setRedactionStyle('white')}
                      className={`p-2.5 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                        redactionStyle === 'white'
                          ? 'border-emerald-600 bg-emerald-50/60 text-emerald-900 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="w-full h-3 bg-white border border-slate-300 rounded mb-1.5 mx-auto" />
                      Blanco
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-1 border-t border-slate-100">
                  {/* Flatten PDF switch */}
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={flattenPdf}
                      onChange={(e) => setFlattenPdf(e.target.checked)}
                      className="w-4 h-4 mt-0.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        Aplanar PDF (Máxima Seguridad RGPD)
                      </p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Destruye irreversiblemente los píxeles bajo las barras. Nadie podrá seleccionar ni copiar el texto original desde el PDF.
                      </p>
                    </div>
                  </label>

                  {/* Remove Metadata switch */}
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={removeMetadata}
                      onChange={(e) => setRemoveMetadata(e.target.checked)}
                      className="w-4 h-4 mt-0.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        Eliminar todos los Metadatos
                      </p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Borra autor, empresa, programas y fechas de creación ocultas en el archivo.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Bottom Action Button */}
              <button
                onClick={handleApplyAnonymization}
                disabled={isProcessing || isScanning || activeCount === 0}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base rounded-2xl shadow-xl shadow-emerald-600/25 transition-all cursor-pointer disabled:bg-slate-300 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Aplicando anonimización...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    <span>Anonimizar ({activeCount}) y Descargar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
