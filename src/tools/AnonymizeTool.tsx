import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  EyeOff,
  Search,
  ShieldCheck,
  Lock,
  Trash2,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Info,
  X,
  FileText,
} from 'lucide-react';
import { Dropzone } from '../components/Dropzone';
import { SuccessView } from '../components/SuccessView';
import {
  getPdfJsDocument,
  detectSensitiveDataInPdf,
  anonymizePdf,
  downloadBlob,
  formatFileSize,
} from '../utils/pdfUtils';
import type { RedactionBox, AnonymizeOptions } from '../types';

interface AnonymizeToolProps {
  onHome: () => void;
}

export const AnonymizeTool: React.FC<AnonymizeToolProps> = ({ onHome }) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.0);

  // Redaction boxes state
  const [boxes, setBoxes] = useState<RedactionBox[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);

  // Detection configuration
  const [detectDni, setDetectDni] = useState<boolean>(true);
  const [detectEmail, setDetectEmail] = useState<boolean>(true);
  const [detectPhone, setDetectPhone] = useState<boolean>(true);
  const [detectIban, setDetectIban] = useState<boolean>(true);
  const [customKeywords, setCustomKeywords] = useState<string>('');

  // Security options
  const [boxStyle, setBoxStyle] = useState<'black' | 'white' | 'redacted-text'>('black');
  const [removeMetadata, setRemoveMetadata] = useState<boolean>(true);
  const [flattenPages, setFlattenPages] = useState<boolean>(true);

  // UI state
  const [activeTab, setActiveTab] = useState<'detect' | 'options' | 'list'>('detect');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanMessage, setScanMessage] = useState<string>('');
  const [scanProgress, setScanProgress] = useState<number>(0);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processMessage, setProcessMessage] = useState<string>('');
  const [processProgress, setProcessProgress] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Result state
  const [resultData, setResultData] = useState<Uint8Array | null>(null);
  const [resultStats, setResultStats] = useState<{
    originalSize: number;
    newSize: number;
    redactedCount: number;
    pagesAffected: number;
  } | null>(null);

  // Canvas & dragging references
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [liveRect, setLiveRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Load PDF file
  const handleFileSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const selected = files[0];
    setFile(selected);
    setErrorMsg(null);
    setResultData(null);
    setResultStats(null);
    setBoxes([]);
    setCurrentPage(1);

    try {
      const buffer = await selected.arrayBuffer();
      setFileBuffer(buffer);
      const pdfJsDoc = await getPdfJsDocument(buffer);
      setTotalPages(pdfJsDoc.numPages);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('No se pudo cargar el archivo PDF.');
    }
  };

  // Render current page to canvas
  const renderCurrentPage = useCallback(async () => {
    if (!fileBuffer || !canvasRef.current) return;
    const canvas = canvasRef.current;

    try {
      const pdfJsDoc = await getPdfJsDocument(fileBuffer);
      const page = await pdfJsDoc.getPage(currentPage);

      // Render at sharp 1.5 scale multiplied by user zoom
      const renderScale = 1.5 * zoom;
      const viewport = page.getViewport({ scale: renderScale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport,
      }).promise;
    } catch (err) {
      console.error('Error al renderizar página:', err);
    }
  }, [fileBuffer, currentPage, zoom]);

  useEffect(() => {
    renderCurrentPage();
  }, [renderCurrentPage]);

  // Run automatic scanner for sensitive data
  const handleRunScanner = async () => {
    if (!fileBuffer) return;
    setIsScanning(true);
    setScanProgress(0);
    setScanMessage('Iniciando análisis de patrones sensibles...');
    setErrorMsg(null);

    try {
      const keywords = customKeywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      const detected = await detectSensitiveDataInPdf(
        fileBuffer,
        {
          dni: detectDni,
          email: detectEmail,
          phone: detectPhone,
          iban: detectIban,
          customKeywords: keywords,
        },
        (msg, pct) => {
          setScanMessage(msg);
          setScanProgress(pct);
        }
      );

      // Apply current default boxStyle to detected items
      const styledDetected = detected.map((b) => ({
        ...b,
        style: boxStyle,
      }));

      // Combine with existing manual boxes without duplicates
      setBoxes((prev) => {
        const manualOnly = prev.filter((b) => b.type === 'manual');
        return [...manualOnly, ...styledDetected];
      });

      setActiveTab('list');
    } catch (err: any) {
      console.error('Error al escanear datos sensibles:', err);
      setErrorMsg('Error durante el análisis del documento: ' + (err.message || ''));
    } finally {
      setIsScanning(false);
      setScanMessage('');
    }
  };

  // Dragging handlers for manual redaction drawing
  const getRelativeCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    // Avoid starting a new box if clicking on an existing box delete button
    if ((e.target as HTMLElement).closest('.box-interactive-action')) return;

    isDraggingRef.current = true;
    const coords = getRelativeCoords(e);
    dragStartRef.current = coords;
    setLiveRect({ x: coords.x, y: coords.y, width: 0, height: 0 });
    setSelectedBoxId(null);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDraggingRef.current || !dragStartRef.current) return;
    const current = getRelativeCoords(e);
    const start = dragStartRef.current;

    const minX = Math.min(start.x, current.x);
    const minY = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);

    setLiveRect({
      x: Math.round(minX * 10) / 10,
      y: Math.round(minY * 10) / 10,
      width: Math.round(width * 10) / 10,
      height: Math.round(height * 10) / 10,
    });
  };

  const handlePointerUp = () => {
    if (!isDraggingRef.current || !liveRect) {
      isDraggingRef.current = false;
      dragStartRef.current = null;
      setLiveRect(null);
      return;
    }

    isDraggingRef.current = false;
    dragStartRef.current = null;

    // Only create box if large enough (at least 1% wide and tall)
    if (liveRect.width > 0.8 && liveRect.height > 0.8) {
      const newBox: RedactionBox = {
        id: 'box_' + Math.random().toString(36).substring(2, 9),
        pageIndex: currentPage - 1,
        x: liveRect.x,
        y: liveRect.y,
        width: liveRect.width,
        height: liveRect.height,
        type: 'manual',
        label: 'Área manual',
        style: boxStyle,
      };

      setBoxes((prev) => [...prev, newBox]);
      setSelectedBoxId(newBox.id);
    }

    setLiveRect(null);
  };

  // Remove a box
  const handleDeleteBox = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setBoxes((prev) => prev.filter((b) => b.id !== id));
    if (selectedBoxId === id) setSelectedBoxId(null);
  };

  // Remove all boxes on current page
  const handleClearCurrentPageBoxes = () => {
    setBoxes((prev) => prev.filter((b) => b.pageIndex !== currentPage - 1));
  };

  // Remove all boxes in the entire document
  const handleClearAllBoxes = () => {
    setBoxes([]);
  };

  // Execute anonymization
  const handleAnonymize = async () => {
    if (!file || !fileBuffer) return;

    if (boxes.length === 0 && !removeMetadata) {
      setErrorMsg('No has marcado ninguna área para censurar ni has activado la eliminación de metadatos.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);
    setProcessProgress(0);
    setProcessMessage('Iniciando proceso de anonimización segura...');

    try {
      const options: AnonymizeOptions = {
        boxes,
        removeMetadata,
        flattenPages,
        defaultBoxColor: boxStyle,
      };

      const res = await anonymizePdf(fileBuffer, options, (msg, pct) => {
        setProcessMessage(msg);
        setProcessProgress(pct);
      });

      setResultData(res.data);
      setResultStats({
        originalSize: file.size,
        newSize: res.data.byteLength,
        redactedCount: res.redactedCount,
        pagesAffected: res.pagesAffected,
      });
    } catch (err: any) {
      console.error('Error al anonimizar:', err);
      setErrorMsg('No se pudo anonimizar el documento: ' + (err.message || ''));
    } finally {
      setIsProcessing(false);
      setProcessMessage('');
    }
  };

  const handleDownload = () => {
    if (!resultData || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    downloadBlob(resultData, `${baseName}_anonimizado.pdf`);
  };

  const handleReset = () => {
    setFile(null);
    setFileBuffer(null);
    setBoxes([]);
    setResultData(null);
    setResultStats(null);
    setErrorMsg(null);
    setCurrentPage(1);
  };

  // Current page boxes
  const currentPageBoxes = boxes.filter((b) => b.pageIndex === currentPage - 1);

  if (resultData && resultStats) {
    return (
      <SuccessView
        title="¡Documento anonimizado con éxito!"
        subtitle={
          resultStats.redactedCount > 0
            ? `Se han censurado permanentemente ${resultStats.redactedCount} datos sensibles en ${resultStats.pagesAffected} página(s) y eliminado todos los metadatos identificativos.`
            : 'Se han eliminado con éxito todos los metadatos confidenciales e información oculta del archivo.'
        }
        onDownload={handleDownload}
        onReset={handleReset}
        onHome={onHome}
        downloadLabel="Descargar PDF Anonimizado"
        stats={{
          originalSize: resultStats.originalSize,
          newSize: resultStats.newSize,
          savedPercentage:
            resultStats.originalSize > resultStats.newSize
              ? Math.round(((resultStats.originalSize - resultStats.newSize) / resultStats.originalSize) * 100)
              : undefined,
        }}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Tool Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-100 text-teal-600 mb-3 shadow-inner">
          <EyeOff className="w-7 h-7" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Anonimizar & Redactar PDF
        </h1>
        <p className="text-slate-500 mt-2 max-w-xl mx-auto text-sm sm:text-base">
          Censura datos personales, oculta información confidencial y limpia los metadatos para cumplir con la normativa de protección de datos (RGPD).
        </p>
      </div>

      {!file && (
        <div className="max-w-2xl mx-auto">
          <Dropzone
            onFilesSelected={handleFileSelected}
            accept=".pdf,application/pdf"
            maxFiles={1}
            title="Arrastra tu archivo PDF aquí"
            subtitle="o haz clic para seleccionar desde tu dispositivo"
          />

          {/* RGPD Guarantee Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-xs text-slate-800">Detección Inteligente</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Encuentra DNI, emails, teléfonos y cuentas bancarias al instante.</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-xs text-slate-800">Aplanado RGPD Seguro</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Fusiona las censuras en la imagen para impedir copiar el texto oculto.</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-xs text-slate-800">100% Privado en Cliente</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Tu archivo se procesa en tu navegador. Cero subidas a servidores.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {file && (
        <div className="space-y-6">
          {/* Top Control Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 truncate max-w-[200px] sm:max-w-xs" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-slate-400">
                  {formatFileSize(file.size)} • {totalPages} {totalPages === 1 ? 'página' : 'páginas'}
                </p>
              </div>
              <button
                onClick={handleReset}
                className="text-xs text-slate-400 hover:text-red-600 hover:underline ml-2 transition-colors cursor-pointer"
              >
                Cambiar archivo
              </button>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-slate-700 min-w-[80px] text-center">
                Pág. {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Página siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-50 px-2 py-1.5 rounded-xl border border-slate-200">
              <button
                onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
                className="p-1 rounded hover:bg-slate-200 text-slate-600 cursor-pointer transition-colors"
                title="Alejar"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-medium text-slate-600 px-1 min-w-[42px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(2.0, z + 0.2))}
                className="p-1 rounded hover:bg-slate-200 text-slate-600 cursor-pointer transition-colors"
                title="Acercar"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Primary Action Button */}
            <button
              onClick={handleAnonymize}
              disabled={isProcessing || isScanning}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold text-sm rounded-xl shadow-md shadow-teal-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Anonimizar PDF ({boxes.length} {boxes.length === 1 ? 'área' : 'áreas'})</span>
                </>
              )}
            </button>
          </div>

          {/* Main Layout: Left Sidebar + Right PDF Viewer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Sidebar */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
              {/* Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('detect')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'detect' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Detección
                </button>
                <button
                  onClick={() => setActiveTab('list')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer relative ${
                    activeTab === 'list' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Censuras ({boxes.length})
                </button>
                <button
                  onClick={() => setActiveTab('options')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'options' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Seguridad
                </button>
              </div>

              {/* TAB 1: AUTOMATIC DETECTION */}
              {activeTab === 'detect' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Buscar y marcar datos automáticamente
                    </h3>
                    <p className="text-xs text-slate-500 mb-3">
                      Selecciona qué tipo de información sensible deseas encontrar en todo el documento:
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100/60 cursor-pointer transition-colors text-xs font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={detectDni}
                          onChange={(e) => setDetectDni(e.target.checked)}
                          className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                        />
                        <span>DNI / NIE / CIF</span>
                      </label>

                      <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100/60 cursor-pointer transition-colors text-xs font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={detectEmail}
                          onChange={(e) => setDetectEmail(e.target.checked)}
                          className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                        />
                        <span>Emails</span>
                      </label>

                      <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100/60 cursor-pointer transition-colors text-xs font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={detectPhone}
                          onChange={(e) => setDetectPhone(e.target.checked)}
                          className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                        />
                        <span>Teléfonos</span>
                      </label>

                      <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100/60 cursor-pointer transition-colors text-xs font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={detectIban}
                          onChange={(e) => setDetectIban(e.target.checked)}
                          className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                        />
                        <span>IBAN / Tarjetas</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Palabras o nombres personalizados
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Juan Pérez, Acme Corp, Proyecto Alfa"
                      value={customKeywords}
                      onChange={(e) => setCustomKeywords(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-slate-400"
                    />
                    <span className="block text-[11px] text-slate-400 mt-1">
                      Separa varias palabras o frases con comas.
                    </span>
                  </div>

                  <button
                    onClick={handleRunScanner}
                    disabled={isScanning || (!detectDni && !detectEmail && !detectPhone && !detectIban && !customKeywords.trim())}
                    className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-semibold text-xs rounded-xl shadow-md shadow-teal-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Analizando documento...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>Escanear y marcar datos sensibles</span>
                      </>
                    )}
                  </button>

                  <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-100 text-teal-900 text-xs flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      También puedes <strong>hacer clic y arrastrar</strong> con el ratón directamente sobre la vista previa del PDF a la derecha para censurar cualquier área manualmente (firmas, fotos, textos escaneados).
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 2: REDACTION BOXES LIST */}
              {activeTab === 'list' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Áreas censuradas ({boxes.length})
                    </h3>
                    {boxes.length > 0 && (
                      <button
                        onClick={handleClearAllBoxes}
                        className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                      >
                        Borrar todas
                      </button>
                    )}
                  </div>

                  {boxes.length === 0 ? (
                    <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <EyeOff className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-600">No hay áreas de censura creadas</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Utiliza el escáner automático o arrastra el cursor sobre la página para añadir tachados.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                      {boxes.map((box, idx) => {
                        const isCurrent = box.pageIndex === currentPage - 1;
                        return (
                          <div
                            key={box.id}
                            onClick={() => {
                              setCurrentPage(box.pageIndex + 1);
                              setSelectedBoxId(box.id);
                            }}
                            className={`p-2 rounded-xl border text-xs flex items-center justify-between gap-2 cursor-pointer transition-all ${
                              selectedBoxId === box.id
                                ? 'bg-teal-50 border-teal-300 text-teal-900'
                                : isCurrent
                                ? 'bg-white border-slate-200 hover:border-slate-300'
                                : 'bg-slate-50/70 border-slate-100 hover:bg-slate-100 text-slate-500'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                                Pág. {box.pageIndex + 1}
                              </span>
                              <span className="truncate font-medium text-slate-800" title={box.text || box.label}>
                                {box.text ? `"${box.text}"` : box.label || `Área #${idx + 1}`}
                              </span>
                            </div>

                            <button
                              onClick={(e) => handleDeleteBox(box.id, e)}
                              className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
                              title="Eliminar esta censura"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {currentPageBoxes.length > 0 && (
                    <button
                      onClick={handleClearCurrentPageBoxes}
                      className="w-full py-1.5 text-xs text-slate-500 hover:text-red-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Limpiar censuras de la página {currentPage} ({currentPageBoxes.length})
                    </button>
                  )}
                </div>
              )}

              {/* TAB 3: SECURITY & STYLES */}
              {activeTab === 'options' && (
                <div className="space-y-4">
                  {/* Style of redaction boxes */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Estilo visual de la censura
                    </label>
                    <div className="space-y-2">
                      <label
                        className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                          boxStyle === 'black'
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="boxStyle"
                          checked={boxStyle === 'black'}
                          onChange={() => setBoxStyle('black')}
                          className="sr-only"
                        />
                        <div className="w-4 h-4 rounded bg-black border border-white/40 shrink-0" />
                        <div className="text-xs">
                          <span className="font-bold block">Bloque Negro Clásico</span>
                          <span className={boxStyle === 'black' ? 'text-slate-300 text-[11px]' : 'text-slate-400 text-[11px]'}>
                            Censura estándar y opaca.
                          </span>
                        </div>
                      </label>

                      <label
                        className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                          boxStyle === 'white'
                            ? 'bg-teal-50 border-teal-500 text-teal-900 shadow-sm'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="boxStyle"
                          checked={boxStyle === 'white'}
                          onChange={() => setBoxStyle('white')}
                          className="sr-only"
                        />
                        <div className="w-4 h-4 rounded bg-white border-2 border-slate-400 shrink-0" />
                        <div className="text-xs">
                          <span className="font-bold block">Bloque Blanco (Tipex)</span>
                          <span className="text-slate-500 text-[11px]">
                            Oculta el texto sin dejar marcas oscuras.
                          </span>
                        </div>
                      </label>

                      <label
                        className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                          boxStyle === 'redacted-text'
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="boxStyle"
                          checked={boxStyle === 'redacted-text'}
                          onChange={() => setBoxStyle('redacted-text')}
                          className="sr-only"
                        />
                        <div className="w-4 h-4 rounded bg-black text-[8px] font-bold text-white flex items-center justify-center border border-white/40 shrink-0">
                          C
                        </div>
                        <div className="text-xs">
                          <span className="font-bold block">Etiqueta [CENSURADO]</span>
                          <span className={boxStyle === 'redacted-text' ? 'text-slate-300 text-[11px]' : 'text-slate-400 text-[11px]'}>
                            Bloque negro con texto de confidencialidad.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Sanitization Options */}
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100/60 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={removeMetadata}
                        onChange={(e) => setRemoveMetadata(e.target.checked)}
                        className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer mt-0.5"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          Eliminar metadatos confidenciales
                        </span>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          Borra autor, software de creación, título, fechas y el paquete de metadatos XML XMP.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-2.5 rounded-xl border border-teal-200 bg-teal-50/40 hover:bg-teal-50/70 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={flattenPages}
                        onChange={(e) => setFlattenPages(e.target.checked)}
                        className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer mt-0.5"
                      />
                      <div>
                        <span className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                          Aplanar páginas modificadas (Seguridad RGPD)
                          <span className="bg-teal-600 text-white text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase">
                            Recomendado
                          </span>
                        </span>
                        <span className="text-[11px] text-teal-800/80 block mt-0.5">
                          Convierte las páginas censuradas a imagen de alta definición. Esto garantiza que <strong>nadie pueda seleccionar ni extraer el texto oculto</strong> por debajo del bloque negro.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Right PDF Viewer Area */}
            <div className="lg:col-span-8 space-y-3">
              {/* Interactive Hint */}
              <div className="bg-slate-800 text-slate-200 px-4 py-2 rounded-xl text-xs flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                  <span>Modo interactivo: Arrastra el cursor sobre la página para dibujar censuras manuales.</span>
                </span>
                <span className="font-semibold text-teal-300">
                  {currentPageBoxes.length} {currentPageBoxes.length === 1 ? 'área en esta página' : 'áreas en esta página'}
                </span>
              </div>

              {/* PDF Canvas Container */}
              <div
                ref={containerRef}
                className="relative bg-slate-200/90 rounded-2xl p-4 sm:p-6 overflow-auto border border-slate-300/80 shadow-inner min-h-[550px] flex items-center justify-center select-none"
              >
                <div
                  className="relative shadow-2xl bg-white border border-slate-300 cursor-crosshair"
                  onMouseDown={handlePointerDown}
                  onMouseMove={handlePointerMove}
                  onMouseUp={handlePointerUp}
                  onTouchStart={handlePointerDown}
                  onTouchMove={handlePointerMove}
                  onTouchEnd={handlePointerUp}
                >
                  {/* Real PDF Canvas */}
                  <canvas ref={canvasRef} className="block pointer-events-none" />

                  {/* Redaction Boxes Overlay */}
                  {currentPageBoxes.map((box) => {
                    const isSelected = selectedBoxId === box.id;
                    const styleType = box.style || boxStyle;

                    return (
                      <div
                        key={box.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBoxId(box.id);
                        }}
                        style={{
                          left: `${box.x}%`,
                          top: `${box.y}%`,
                          width: `${box.width}%`,
                          height: `${box.height}%`,
                        }}
                        className={`absolute group transition-shadow ${
                          styleType === 'white'
                            ? 'bg-white border border-slate-400/80'
                            : styleType === 'redacted-text'
                            ? 'bg-black text-white font-bold flex items-center justify-center overflow-hidden border border-black'
                            : 'bg-black border border-black'
                        } ${isSelected ? 'ring-2 ring-teal-400 shadow-lg' : 'hover:ring-1 hover:ring-teal-300'}`}
                      >
                        {styleType === 'redacted-text' && (
                          <span className="text-[9px] tracking-widest uppercase select-none px-1 text-center font-mono">
                            CENSURADO
                          </span>
                        )}

                        {/* Delete Button on Hover / Selection */}
                        <button
                          onClick={(e) => handleDeleteBox(box.id, e)}
                          className="box-interactive-action absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
                          title="Eliminar censura"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Live Drawing Preview Box */}
                  {liveRect && (
                    <div
                      style={{
                        left: `${liveRect.x}%`,
                        top: `${liveRect.y}%`,
                        width: `${liveRect.width}%`,
                        height: `${liveRect.height}%`,
                      }}
                      className="absolute border-2 border-teal-500 bg-teal-500/30 pointer-events-none z-10"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress / Loading Modal */}
      {(isProcessing || isScanning) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-teal-100 text-teal-600 mx-auto flex items-center justify-center mb-5 shadow-inner">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>

            <h3 className="text-xl font-bold text-slate-900">
              {isScanning ? 'Escaneando Documento' : 'Anonimizando Documento'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-6">
              {isScanning ? scanMessage : processMessage}
            </p>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-2">
              <div
                className="bg-teal-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${isScanning ? scanProgress : processProgress}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-teal-700">
              {isScanning ? scanProgress : processProgress}% completado
            </span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="flex-1">{errorMsg}</p>
          <button
            onClick={() => setErrorMsg(null)}
            className="p-1 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
