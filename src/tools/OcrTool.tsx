import React, { useState } from 'react';
import {
  ScanText,
  Copy,
  Check,
  Download,
  RotateCcw,
  Languages,
  Loader2,
  FileCheck,
  AlertCircle,
  FileText,
  Search,
  Sparkles,
} from 'lucide-react';
import { Dropzone } from '../components/Dropzone';
import {
  performOcr,
  exportOcrResultToPdf,
  downloadBlob,
  formatFileSize,
  type OcrResult,
} from '../utils/pdfUtils';

interface OcrToolProps {
  onHome: () => void;
}

const SUPPORTED_LANGUAGES = [
  { code: 'spa', label: 'Español' },
  { code: 'eng', label: 'English' },
  { code: 'fra', label: 'Français' },
  { code: 'deu', label: 'Deutsch' },
  { code: 'ita', label: 'Italiano' },
  { code: 'por', label: 'Português' },
];

export const OcrTool: React.FC<OcrToolProps> = ({ onHome: _onHome }) => {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<string>('spa');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');
  const [progressPct, setProgressPct] = useState<number>(0);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [editableText, setEditableText] = useState<string>('');
  const [selectedPageIndex, setSelectedPageIndex] = useState<number | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileSelected = (files: File[]) => {
    if (files.length === 0) return;
    setFile(files[0]);
    setErrorMsg(null);
    setOcrResult(null);
  };

  const handleStartOcr = async () => {
    if (!file) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setProgressPct(5);
    setProgressText('Iniciando motor OCR...');

    try {
      const result = await performOcr(file, language, (text, pct) => {
        setProgressText(text);
        setProgressPct(pct);
      });

      setOcrResult(result);
      setEditableText(result.fullText);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Error durante el reconocimiento óptico de caracteres.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    const textToCopy =
      selectedPageIndex === 'all'
        ? editableText
        : ocrResult?.pages[selectedPageIndex]?.text || '';

    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = textToCopy;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadTxt = () => {
    if (!file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const textToDownload =
      selectedPageIndex === 'all'
        ? editableText
        : ocrResult?.pages[selectedPageIndex]?.text || '';

    const blob = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${baseName}_ocr.txt`, 'text/plain');
  };

  const handleDownloadPdf = async () => {
    if (!file || !ocrResult) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    try {
      // Create copy with currently edited text if user modified it
      const resultToExport: OcrResult = {
        ...ocrResult,
        pages: ocrResult.pages.map((p, idx) => ({
          ...p,
          text:
            selectedPageIndex === idx
              ? editableText
              : p.text,
        })),
      };
      const pdfBytes = await exportOcrResultToPdf(resultToExport);
      downloadBlob(pdfBytes, `${baseName}_ocr.pdf`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error al generar el PDF digitalizado.');
    }
  };

  const handleReset = () => {
    setFile(null);
    setOcrResult(null);
    setEditableText('');
    setSelectedPageIndex('all');
    setProgressPct(0);
    setProgressText('');
    setErrorMsg(null);
  };

  // Word and character count calculation
  const currentDisplayedText =
    selectedPageIndex === 'all'
      ? editableText
      : ocrResult?.pages[selectedPageIndex]?.text || '';
  const wordCount = currentDisplayedText.trim() ? currentDisplayedText.trim().split(/\s+/).length : 0;
  const charCount = currentDisplayedText.length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Title */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-100 text-teal-600 mb-3 shadow-inner">
          <ScanText className="w-7 h-7" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          OCR Reconocer Texto
        </h1>
        <p className="text-slate-500 mt-2 text-base max-w-xl mx-auto">
          Convierte PDFs escaneados o imágenes en texto digital seleccionable y editable sin salir del navegador.
        </p>
      </div>

      {!file ? (
        <Dropzone
          onFilesSelected={handleFileSelected}
          multiple={false}
          accept="application/pdf,image/png,image/jpeg,image/webp"
          title="Seleccionar archivo PDF o Imagen"
          subtitle="Soporta documentos PDF escaneados, fotos o capturas PNG/JPG"
        />
      ) : !ocrResult ? (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
                <FileCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate max-w-xs sm:max-w-md">
                  {file.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tamaño: {formatFileSize(file.size)}
                </p>
              </div>
            </div>

            <button
              onClick={handleReset}
              disabled={isProcessing}
              className="text-xs font-semibold text-slate-500 hover:text-red-600 cursor-pointer disabled:opacity-50"
            >
              Cambiar archivo
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="ocr-language-select"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5"
              >
                <Languages className="w-4 h-4 text-teal-600" />
                Idioma del documento
              </label>
              <select
                id="ocr-language-select"
                aria-label="Idioma del documento"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={isProcessing}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none disabled:bg-slate-100"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label} ({lang.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="p-4 bg-teal-50/70 border border-teal-100 rounded-2xl flex items-start gap-3 text-xs text-teal-900">
              <Sparkles className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
              <p>
                El motor OCR procesa el documento localmente usando inteligencia artificial en tu navegador. Tus archivos nunca viajan a ningún servidor externo.
              </p>
            </div>

            {isProcessing && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                    {progressText || 'Procesando...'}
                  </span>
                  <span className="text-teal-600 font-extrabold">{progressPct}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-teal-500 h-full rounded-full transition-[width] duration-300 ease-out"
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

            <button
              onClick={handleStartOcr}
              disabled={isProcessing}
              className="w-full inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-lg rounded-2xl shadow-xl shadow-teal-600/25 transition-[background-color,box-shadow] cursor-pointer disabled:bg-slate-300"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Reconociendo texto...</span>
                </>
              ) : (
                <>
                  <ScanText className="w-5 h-5" />
                  <span>Comenzar OCR</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Results View */
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          {/* Header Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-teal-100 text-teal-800 text-xs font-extrabold uppercase rounded-lg">
                  Texto Reconocido
                </span>
                <span className="text-xs text-slate-500">
                  {ocrResult.pages.length} {ocrResult.pages.length === 1 ? 'página' : 'páginas'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1 truncate max-w-sm sm:max-w-md">
                {file.name}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
              </button>

              <button
                onClick={handleDownloadTxt}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-md shadow-teal-600/20 transition-[background-color,box-shadow] cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Descargar TXT</span>
              </button>

              <button
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md shadow-slate-900/20 transition-[background-color,box-shadow] cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Descargar PDF</span>
              </button>

              <button
                onClick={handleReset}
                title="Procesar otro archivo"
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stats & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 w-full sm:w-auto">
              <span>{wordCount} palabras</span>
              <span>•</span>
              <span>{charCount} caracteres</span>
              {ocrResult.pages.length > 0 && (
                <>
                  <span>•</span>
                  <span>
                    Confianza media:{' '}
                    {Math.round(
                      ocrResult.pages.reduce((acc, p) => acc + p.confidence, 0) /
                        ocrResult.pages.length
                    )}
                    %
                  </span>
                </>
              )}
            </div>

            {/* In-text search */}
            <div className="relative w-full sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                aria-label="Buscar en el texto reconocido"
                placeholder="Buscar palabra..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Page Tabs if multi-page */}
          {ocrResult.pages.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-100">
              <button
                onClick={() => setSelectedPageIndex('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  selectedPageIndex === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todas las páginas
              </button>
              {ocrResult.pages.map((p, idx) => (
                <button
                  key={p.pageNumber}
                  onClick={() => setSelectedPageIndex(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    selectedPageIndex === idx
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Pág {p.pageNumber}
                </button>
              ))}
            </div>
          )}

          {/* Text Area */}
          <div>
            <textarea
              aria-label="Contenido del texto reconocido por OCR"
              value={currentDisplayedText}
              onChange={(e) => {
                if (selectedPageIndex === 'all') {
                  setEditableText(e.target.value);
                } else if (ocrResult) {
                  const updatedPages = [...ocrResult.pages];
                  updatedPages[selectedPageIndex] = {
                    ...updatedPages[selectedPageIndex],
                    text: e.target.value,
                  };
                  setOcrResult({ ...ocrResult, pages: updatedPages });
                }
              }}
              rows={15}
              className="w-full p-4 font-mono text-sm leading-relaxed bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none resize-y text-slate-800"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
            <span className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-400" />
              Puedes editar el texto directamente en el recuadro antes de copiar o descargar.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
