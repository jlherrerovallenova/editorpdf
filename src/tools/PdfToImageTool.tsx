import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  FileImage,
  Download,
  Archive,
  Loader2,
  AlertCircle,
  FileCheck,
  CheckCircle2,
  Trash2,
  Plus,
  Search,
  Maximize2,
  Eye,
  X,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
  Zap,
  Home,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Dropzone } from '../components/Dropzone';
import {
  downloadBlob,
  createZip,
  formatFileSize,
  batchConvertPdfToImages,
  getPdfPageCount,
  type BatchConvertProgressInfo,
  type ConvertedPdfResult,
  type BatchConvertSummary,
} from '../utils/pdfUtils';

interface PdfToImageToolProps {
  onHome: () => void;
}

interface UploadedPdfItem {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount?: number;
  isLoadingPages?: boolean;
}

interface PreviewModalData {
  url: string;
  name: string;
  pageNumber: number;
  pdfName: string;
  blob: Blob;
}

export const PdfToImageTool: React.FC<PdfToImageToolProps> = ({ onHome }) => {
  const [files, setFiles] = useState<UploadedPdfItem[]>([]);
  const [format, setFormat] = useState<'image/jpeg' | 'image/png'>('image/jpeg');
  const [qualityScale, setQualityScale] = useState<number>(1.5); // 1.0 (96 DPI), 1.5 (150 DPI), 2.5 (300 DPI)
  const [pageScope, setPageScope] = useState<'all' | 'first'>('all');
  const [folderStructure, setFolderStructure] = useState<'folders' | 'flat'>('folders');

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<BatchConvertProgressInfo | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [result, setResult] = useState<BatchConvertSummary | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedPdfId, setExpandedPdfId] = useState<string | null>(null);
  const [previewModal, setPreviewModal] = useState<PreviewModalData | null>(null);

  const addFileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOverList, setIsDraggingOverList] = useState(false);

  // Clean up object URLs on unmount or reset
  useEffect(() => {
    return () => {
      if (result) {
        result.results.forEach((pdf) => {
          pdf.images.forEach((img) => {
            URL.revokeObjectURL(img.previewUrl);
          });
        });
      }
    };
  }, [result]);

  // Confetti when result is ready
  useEffect(() => {
    if (result && result.totalImages > 0) {
      try {
        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#3b82f6', '#10b981', '#6366f1', '#ec4899'],
        });
      } catch {
        // canvas-confetti error fallback
      }
    }
  }, [result]);

  // Add files to queue
  const handleFilesAdded = (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    setErrorMsg(null);

    const pdfOnly = newFiles.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));

    if (pdfOnly.length === 0) {
      setErrorMsg('Por favor, selecciona únicamente archivos con formato PDF.');
      return;
    }

    const newItems: UploadedPdfItem[] = pdfOnly.map((file) => ({
      id: Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
      file,
      name: file.name,
      size: file.size,
      isLoadingPages: true,
    }));

    setFiles((prev) => [...prev, ...newItems]);

    // Asynchronously resolve page counts in queue
    newItems.forEach(async (item) => {
      try {
        const pageCount = await getPdfPageCount(item.file);
        setFiles((current) =>
          current.map((f) =>
            f.id === item.id ? { ...f, pageCount, isLoadingPages: false } : f
          )
        );
      } catch {
        setFiles((current) =>
          current.map((f) =>
            f.id === item.id ? { ...f, pageCount: 1, isLoadingPages: false } : f
          )
        );
      }
    });
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClearAll = () => {
    setFiles([]);
    setErrorMsg(null);
  };

  const totalBytes = useMemo(() => files.reduce((acc, f) => acc + f.size, 0), [files]);
  const estimatedTotalPages = useMemo(() => {
    if (pageScope === 'first') return files.length;
    return files.reduce((acc, f) => acc + (f.pageCount || 1), 0);
  }, [files, pageScope]);

  // Start conversion
  const handleConvert = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setErrorMsg(null);
    const controller = new AbortController();
    setAbortController(controller);

    try {
      const summary = await batchConvertPdfToImages(
        files.map((f) => ({ id: f.id, name: f.name, file: f.file })),
        {
          format,
          scale: qualityScale,
          quality: 0.92,
          pageScope,
          folderStructure,
          signal: controller.signal,
          onProgress: (p) => setProgress(p),
        }
      );
      setResult(summary);
      if (summary.results.length === 1 && summary.results[0]?.images.length > 0) {
        setExpandedPdfId(summary.results[0].id);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('cancelada')) {
        setErrorMsg('La conversión fue cancelada por el usuario.');
      } else {
        console.error('Batch convert error:', err);
        setErrorMsg(err?.message || 'Ocurrió un error inesperado al convertir los archivos PDF.');
      }
    } finally {
      setIsProcessing(false);
      setProgress(null);
      setAbortController(null);
    }
  };

  const handleCancel = () => {
    if (abortController) {
      abortController.abort();
    }
  };

  const handleReset = () => {
    if (result) {
      result.results.forEach((pdf) => {
        pdf.images.forEach((img) => {
          URL.revokeObjectURL(img.previewUrl);
        });
      });
    }
    setFiles([]);
    setResult(null);
    setErrorMsg(null);
    setProgress(null);
    setExpandedPdfId(null);
    setPreviewModal(null);
    setSearchTerm('');
  };

  const handleDownloadMasterZip = () => {
    if (!result) return;
    const ext = format === 'image/jpeg' ? 'jpg' : 'png';
    const zipName =
      result.results.length === 1 && result.results[0]
        ? `${result.results[0].baseName}_imagenes_${ext}.zip`
        : `PDFs_a_${ext.toUpperCase()}_Lote.zip`;
    downloadBlob(result.masterZipBlob, zipName, 'application/zip');
  };

  const handleDownloadSinglePdfZip = async (pdfRes: ConvertedPdfResult) => {
    if (pdfRes.images.length === 0) return;
    const ext = format === 'image/jpeg' ? 'jpg' : 'png';
    const singleZip = await createZip(
      pdfRes.images.map((img) => ({ name: img.name, blob: img.blob }))
    );
    downloadBlob(singleZip, `${pdfRes.baseName}_${ext}.zip`, 'application/zip');
  };

  // Filtered converted results for search
  const filteredResults = useMemo(() => {
    if (!result) return [];
    if (!searchTerm.trim()) return result.results;
    const term = searchTerm.toLowerCase().trim();
    return result.results.filter(
      (r) => r.fileName.toLowerCase().includes(term) || r.baseName.toLowerCase().includes(term)
    );
  }, [result, searchTerm]);

  // Handle Drag Over the queue area to add more files
  const handleDragOverList = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverList(true);
  };

  const handleDragLeaveList = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverList(false);
  };

  const handleDropList = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverList(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(Array.from(e.dataTransfer.files));
    }
  };

  // ==========================================
  // VIEW 1: RESULTS VIEW (COMPLETED CONVERSION)
  // ==========================================
  if (result) {
    const successPdfs = result.results.filter((r) => !r.error && r.images.length > 0);
    const failedPdfs = result.results.filter((r) => r.error);
    const isSinglePdf = result.results.length === 1;

    return (
      <div className="max-w-6xl mx-auto px-4 py-8 animate-fade-in">
        {/* Success Banner */}
        <div className="w-full bg-white rounded-3xl p-8 sm:p-12 shadow-xl border border-slate-100 text-center mb-10">
          <div className="w-20 h-20 rounded-full bg-emerald-100 border-4 border-emerald-50 mx-auto flex items-center justify-center text-emerald-600 mb-6 shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {isSinglePdf
              ? '¡Tu PDF se ha convertido a imágenes!'
              : '¡Conversión masiva completada con éxito!'}
          </h2>
          <p className="text-slate-500 mt-2 text-sm sm:text-base max-w-xl mx-auto">
            {isSinglePdf
              ? `Se han generado ${result.totalImages} imágenes de alta resolución listas para descargar.`
              : `Se han procesado ${successPdfs.length} archivos PDF y generado ${result.totalImages} imágenes en total.`}
          </p>

          {/* Stats Bar */}
          <div className="my-8 p-6 bg-slate-50/80 rounded-2xl border border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <span className="block text-xs uppercase tracking-wider font-semibold text-slate-400">
                PDFs Procesados
              </span>
              <span className="text-xl font-bold text-slate-800">
                {successPdfs.length} / {result.totalPdfCount}
              </span>
            </div>
            <div>
              <span className="block text-xs uppercase tracking-wider font-semibold text-slate-400">
                Imágenes Generadas
              </span>
              <span className="text-xl font-bold text-amber-600">
                {result.totalImages} {format === 'image/jpeg' ? 'JPGs' : 'PNGs'}
              </span>
            </div>
            <div>
              <span className="block text-xs uppercase tracking-wider font-semibold text-slate-400">
                Resolución
              </span>
              <span className="text-xl font-bold text-slate-800">
                {qualityScale === 1.0 ? '96 DPI' : qualityScale === 1.5 ? '150 DPI' : '300 DPI'}
              </span>
            </div>
            <div>
              <span className="block text-xs uppercase tracking-wider font-semibold text-slate-400">
                Tamaño del ZIP
              </span>
              <span className="text-xl font-bold text-emerald-600">
                {formatFileSize(result.masterZipBlob.size)}
              </span>
            </div>
          </div>

          {/* Main Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleDownloadMasterZip}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 active:from-amber-700 active:to-amber-800 text-white font-extrabold text-base sm:text-lg rounded-2xl shadow-xl shadow-amber-500/25 hover:shadow-amber-500/35 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <Download className="w-5 h-5" />
              <span>
                {isSinglePdf
                  ? `Descargar Todas las Imágenes (.ZIP)`
                  : `Descargar Todo el Lote (.ZIP)`}
              </span>
            </button>

            <button
              onClick={handleReset}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-2xl transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Convertir más PDFs
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center">
            <button
              onClick={onHome}
              className="text-xs font-semibold text-slate-400 hover:text-amber-600 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              Volver al inicio de herramientas PDF
            </button>
          </div>
        </div>

        {/* Failed files notice if any */}
        {failedPdfs.length > 0 && (
          <div className="mb-8 p-5 bg-amber-50/80 border border-amber-200 rounded-2xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-900">
                  {failedPdfs.length} de {result.totalPdfCount} archivos no se pudieron procesar:
                </h4>
                <ul className="mt-2 space-y-1 text-xs text-amber-800">
                  {failedPdfs.map((f) => (
                    <li key={f.id} className="flex items-center gap-1.5">
                      <span className="font-semibold">{f.fileName}:</span>
                      <span>{f.error || 'Error al leer el archivo'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Gallery / Results List Header */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <span>Documentos e imágenes generadas:</span>
                <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2.5 py-0.5 rounded-full">
                  {successPdfs.length} {successPdfs.length === 1 ? 'documento' : 'documentos'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Puedes previsualizar cada página a tamaño completo o descargar individualmente.
              </p>
            </div>

            {/* Search if multiple PDFs */}
            {successPdfs.length > 2 && (
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar documento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                />
              </div>
            )}
          </div>

          {/* Results List */}
          <div className="mt-6 space-y-4">
            {filteredResults.filter((r) => !r.error).length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                No se encontraron documentos con el nombre "{searchTerm}".
              </div>
            ) : (
              filteredResults
                .filter((r) => !r.error)
                .map((pdf) => {
                  const isExpanded = isSinglePdf || expandedPdfId === pdf.id;
                  const firstImg = pdf.images[0];

                  return (
                    <div
                      key={pdf.id}
                      className="border border-slate-200/80 rounded-2xl p-4 sm:p-5 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                    >
                      {/* Document Card Header */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          {/* First Page Mini Thumbnail */}
                          {firstImg && (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewModal({
                                  url: firstImg.previewUrl,
                                  name: firstImg.name,
                                  pageNumber: firstImg.pageNumber,
                                  pdfName: pdf.fileName,
                                  blob: firstImg.blob,
                                })
                              }
                              className="relative w-14 h-18 bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm shrink-0 hover:scale-105 transition-transform group cursor-pointer"
                              title="Click para ampliar vista previa"
                            >
                              <img
                                src={firstImg.previewUrl}
                                alt={firstImg.name}
                                className="w-full h-full object-contain"
                              />
                              <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                <Eye className="w-4 h-4" />
                              </div>
                            </button>
                          )}

                          <div>
                            <h4 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                              <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                              <span className="truncate max-w-xs sm:max-w-md">{pdf.fileName}</span>
                            </h4>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                              <span>
                                {pdf.images.length} {pdf.images.length === 1 ? 'imagen' : 'imágenes'} ({format === 'image/jpeg' ? 'JPG' : 'PNG'})
                              </span>
                              <span>•</span>
                              <span>Páginas extraídas: {pdf.images.length} de {pdf.pageCount}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions for this PDF */}
                        <div className="flex items-center gap-2 self-end sm:self-center w-full sm:w-auto justify-end">
                          <button
                            type="button"
                            onClick={() => handleDownloadSinglePdfZip(pdf)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl border border-amber-200 transition-colors cursor-pointer"
                            title="Descargar las imágenes de este documento en un ZIP individual"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            <span>Descargar ZIP ({pdf.images.length})</span>
                          </button>

                          {!isSinglePdf && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedPdfId(expandedPdfId === pdf.id ? null : pdf.id)
                              }
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
                            >
                              <span>{isExpanded ? 'Ocultar' : 'Ver imágenes'}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded Grid of Images */}
                      {isExpanded && (
                        <div className="mt-5 pt-4 border-t border-slate-200/70">
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {pdf.images.map((img) => (
                              <div
                                key={img.name}
                                className="bg-white rounded-2xl p-2.5 border border-slate-200 shadow-xs flex flex-col justify-between group hover:border-amber-400 transition-colors"
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewModal({
                                      url: img.previewUrl,
                                      name: img.name,
                                      pageNumber: img.pageNumber,
                                      pdfName: pdf.fileName,
                                      blob: img.blob,
                                    })
                                  }
                                  className="relative aspect-[3/4] rounded-xl overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center p-1 cursor-pointer w-full"
                                  title="Click para ver en grande"
                                >
                                  <img
                                    src={img.previewUrl}
                                    alt={img.name}
                                    className="max-w-full max-h-full object-contain"
                                    loading="lazy"
                                  />
                                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity rounded-xl">
                                    <Maximize2 className="w-5 h-5" />
                                  </div>
                                  <span className="absolute top-1 left-1 bg-slate-900/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                                    Pág {img.pageNumber}
                                  </span>
                                </button>

                                <div className="mt-2.5 flex items-center justify-between gap-1">
                                  <span className="text-[11px] font-semibold text-slate-600 truncate max-w-[100px]" title={img.name}>
                                    Pág. {img.pageNumber}
                                  </span>
                                  <button
                                    onClick={() => downloadBlob(img.blob, img.name, format)}
                                    className="p-1 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                    title="Descargar esta imagen"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* Image Full Preview Modal */}
        {previewModal && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setPreviewModal(null)}
          >
            <div
              className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    {previewModal.pdfName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Página {previewModal.pageNumber} ({previewModal.name})
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadBlob(previewModal.blob, previewModal.name, format)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar Imagen</span>
                  </button>
                  <button
                    onClick={() => setPreviewModal(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-6 flex-1 overflow-auto bg-slate-100/60 flex items-center justify-center min-h-[300px]">
                <img
                  src={previewModal.url}
                  alt={previewModal.name}
                  className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-lg border border-slate-200"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 2: INITIAL & QUEUE VIEW (UPLOAD / EDIT)
  // ==========================================
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Title & Introduction */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 mb-3 shadow-inner">
          <FileImage className="w-7 h-7" />
        </div>
        <div className="flex items-center justify-center gap-2 mb-1">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            PDF a JPG Masivo
          </h1>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wide">
            <Zap className="w-3 h-3 text-amber-600" />
            Sin Límite
          </span>
        </div>
        <p className="text-slate-500 mt-2 text-base">
          Convierte uno o decenas de documentos PDF a imágenes de forma masiva en lote, 100% privado en tu navegador.
        </p>

        {/* Feature Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs font-semibold text-slate-600">
          <span className="px-3 py-1 bg-white border border-slate-200 rounded-full shadow-2xs flex items-center gap-1.5">
            ⚡ Convierte tantos PDFs como quieras
          </span>
          <span className="px-3 py-1 bg-white border border-slate-200 rounded-full shadow-2xs flex items-center gap-1.5">
            📦 Descarga en ZIP con carpetas ordenadas
          </span>
          <span className="px-3 py-1 bg-white border border-slate-200 rounded-full shadow-2xs flex items-center gap-1.5">
            🔒 Procesamiento local 100% confidencial
          </span>
        </div>
      </div>

      {files.length === 0 ? (
        <Dropzone
          onFilesSelected={handleFilesAdded}
          multiple={true}
          title="Seleccionar archivos PDF"
          buttonLabel="Elegir archivos PDF (sin límite)"
          subtitle="o arrastra y suelta uno o varios PDFs aquí"
        />
      ) : (
        <div className="space-y-6">
          {/* File Queue Box */}
          <div
            onDragOver={handleDragOverList}
            onDragLeave={handleDragLeaveList}
            onDrop={handleDropList}
            className={`bg-white rounded-3xl p-6 sm:p-8 border shadow-sm transition-all ${
              isDraggingOverList
                ? 'border-amber-500 bg-amber-50/40 ring-4 ring-amber-500/10'
                : 'border-slate-200'
            }`}
          >
            {/* Queue Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 border-b border-slate-100 gap-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base sm:text-lg flex items-center gap-2">
                  <span>Archivos preparados en la cola:</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800">
                    {files.length} {files.length === 1 ? 'archivo' : 'archivos'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tamaño total: {formatFileSize(totalBytes)} • Aprox. {estimatedTotalPages} páginas en total
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <input
                  ref={addFileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) handleFilesAdded(Array.from(e.target.files));
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => addFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl border border-amber-200 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Añadir más PDFs</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearAll}
                  className="inline-flex items-center gap-1 px-3 py-2 text-slate-500 hover:text-red-600 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Vaciar</span>
                </button>
              </div>
            </div>

            {/* Queue Items List */}
            <div className="mt-4 max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {files.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/70 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 text-center text-xs font-bold text-slate-400">
                      {idx + 1}
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                      <FileCheck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-800 truncate" title={item.name}>
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>{formatFileSize(item.size)}</span>
                        <span>•</span>
                        {item.isLoadingPages ? (
                          <span className="inline-flex items-center gap-1 text-slate-500">
                            <Loader2 className="w-3 h-3 animate-spin" /> contando págs...
                          </span>
                        ) : (
                          <span className="font-semibold text-slate-600">
                            {item.pageCount} {item.pageCount === 1 ? 'página' : 'páginas'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveFile(item.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                    title="Eliminar este archivo de la cola"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Drag & Drop Hint */}
            <div className="mt-4 pt-3 border-t border-slate-100 text-center text-xs text-slate-400">
              💡 Puedes arrastrar más archivos PDF directamente sobre este recuadro para añadirlos en cualquier momento.
            </div>
          </div>

          {/* Options & Settings Panel */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Opciones de conversión masiva</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Image Format */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Formato de Imagen
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormat('image/jpeg')}
                    className={`py-3 px-3 text-xs font-bold rounded-2xl border transition-all cursor-pointer ${
                      format === 'image/jpeg'
                        ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    JPG (Recomendado)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat('image/png')}
                    className={`py-3 px-3 text-xs font-bold rounded-2xl border transition-all cursor-pointer ${
                      format === 'image/png'
                        ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    PNG (Sin pérdida)
                  </button>
                </div>
              </div>

              {/* Resolution / DPI */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Resolución y Nitidez
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setQualityScale(1.0)}
                    className={`py-3 px-2 text-[11px] font-bold rounded-2xl border transition-all cursor-pointer text-center ${
                      qualityScale === 1.0
                        ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                    title="Ideal para lotes grandes y archivos ligeros"
                  >
                    Rápida (96 DPI)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQualityScale(1.5)}
                    className={`py-3 px-2 text-[11px] font-bold rounded-2xl border transition-all cursor-pointer text-center ${
                      qualityScale === 1.5
                        ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                    title="Equilibrio recomendado de calidad y velocidad"
                  >
                    Estándar (150 DPI)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQualityScale(2.5)}
                    className={`py-3 px-2 text-[11px] font-bold rounded-2xl border transition-all cursor-pointer text-center ${
                      qualityScale === 2.5
                        ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                    title="Máxima nitidez e impresión profesional"
                  >
                    Alta (300 DPI)
                  </button>
                </div>
              </div>

              {/* Pages to extract */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Páginas a Convertir
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPageScope('all')}
                    className={`py-3 px-3 text-xs font-bold rounded-2xl border transition-all cursor-pointer ${
                      pageScope === 'all'
                        ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    Todas las páginas
                  </button>
                  <button
                    type="button"
                    onClick={() => setPageScope('first')}
                    className={`py-3 px-3 text-xs font-bold rounded-2xl border transition-all cursor-pointer ${
                      pageScope === 'first'
                        ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                    title="Convierte solo la primera página de cada PDF (ideal para portadas o catálogos)"
                  >
                    Solo 1ª pág (Portadas)
                  </button>
                </div>
              </div>

              {/* ZIP Structure */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Estructura en archivo ZIP
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFolderStructure('folders')}
                    className={`py-3 px-3 text-xs font-bold rounded-2xl border transition-all cursor-pointer ${
                      folderStructure === 'folders'
                        ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                    title="Crea una carpeta dentro del ZIP para cada documento PDF"
                  >
                    Carpetas por PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setFolderStructure('flat')}
                    className={`py-3 px-3 text-xs font-bold rounded-2xl border transition-all cursor-pointer ${
                      folderStructure === 'flat'
                        ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                    title="Pone todas las imágenes en la raíz del ZIP con el nombre del documento como prefijo"
                  >
                    Todo en la raíz
                  </button>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 border border-red-200 rounded-2xl text-sm font-semibold">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Processing State Card */}
            {isProcessing && progress && (
              <div className="p-6 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-6 h-6 text-amber-600 animate-spin" />
                    <div>
                      <h4 className="font-bold text-amber-950 text-sm sm:text-base">
                        {progress.statusText || 'Procesando archivos PDF...'}
                      </h4>
                      <p className="text-xs text-amber-800">
                        {progress.fileIndex > 0
                          ? `Archivo ${progress.fileIndex} de ${progress.totalFiles} • Página ${progress.pageIndex} de ${progress.totalPagesInFile}`
                          : 'Iniciando proceso...'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-3.5 py-1.5 text-xs font-bold text-red-600 bg-red-100/80 hover:bg-red-200 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-amber-200/60 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-amber-600 h-3 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.max(4, progress.percentage)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-amber-900 font-semibold">
                  <span>
                    Progreso total: {progress.totalProcessedPages} / {progress.totalEstimatedPages} páginas
                  </span>
                  <span>{progress.percentage}%</span>
                </div>
              </div>
            )}

            {/* CTA Convert Button */}
            {!isProcessing && (
              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={handleConvert}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-10 py-5 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 active:from-amber-700 active:to-amber-800 text-white font-extrabold text-xl rounded-2xl shadow-xl shadow-amber-500/25 hover:shadow-amber-500/35 transition-all transform hover:-translate-y-0.5 cursor-pointer"
                >
                  <FileImage className="w-6 h-6" />
                  <span>
                    Convertir {files.length} {files.length === 1 ? 'PDF' : 'PDFs'} a {format === 'image/jpeg' ? 'JPG' : 'PNG'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
