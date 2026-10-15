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
  ExternalLink,
  Zap,
  Sliders,
} from 'lucide-react';
import { Dropzone } from '../components/Dropzone';
import {
  performOcr,
  exportOcrResultToPdf,
  exportOcrResultToDocx,
  downloadBlob,
  formatFileSize,
  type OcrResult,
} from '../utils/pdfUtils';

interface OcrToolProps {
  onHome: () => void;
}

const SUPPORTED_LANGUAGES = [
  { code: 'spa', label: 'Español' },
  { code: 'spa+eng', label: 'Español + Inglés (Bilingüe)' },
  { code: 'eng', label: 'English' },
  { code: 'fra', label: 'Français' },
  { code: 'deu', label: 'Deutsch' },
  { code: 'ita', label: 'Italiano' },
  { code: 'por', label: 'Português' },
  { code: 'cat', label: 'Català' },
  { code: 'glg', label: 'Galego' },
  { code: 'eus', label: 'Euskera' },
];

export const OcrTool: React.FC<OcrToolProps> = ({ onHome: _onHome }) => {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<string>('spa');
  const [ocrMode, setOcrMode] = useState<'hybrid' | 'ocr'>('hybrid');
  const [enhanceContrast, setEnhanceContrast] = useState<boolean>(true);

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
    setProgressText('Iniciando motor de reconocimiento...');

    try {
      const result = await performOcr(
        file,
        {
          language,
          mode: ocrMode,
          enhanceContrast,
        },
        (text, pct) => {
          setProgressText(text);
          setProgressPct(pct);
        }
      );

      setOcrResult(result);
      setEditableText(result.fullText);
      setSelectedPageIndex('all');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Error durante el reconocimiento óptico de caracteres.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper to get synced OcrResult including any user edits made in textarea
  const getExportableOcrResult = (): OcrResult => {
    if (!ocrResult) {
      return {
        fullText: editableText,
        pages: [{ pageNumber: 1, text: editableText, confidence: 100, method: 'ocr' }],
      };
    }

    if (selectedPageIndex === 'all') {
      if (ocrResult.pages.length <= 1) {
        return {
          ...ocrResult,
          fullText: editableText,
          pages: [{ ...ocrResult.pages[0], text: editableText }],
        };
      }

      // Multi-page document: extract sections by page header if present, or assign proportionally
      const updatedPages = ocrResult.pages.map((p) => {
        const regex = new RegExp(
          `--- PÁGINA ${p.pageNumber} ---\\s*\\n\\n([\\s\\S]*?)(?=(?:--- PÁGINA \\d+ ---|$))`,
          'i'
        );
        const match = editableText.match(regex);
        if (match && match[1] !== undefined) {
          return { ...p, text: match[1].trim() };
        }
        return p;
      });

      return {
        ...ocrResult,
        fullText: editableText,
        pages: updatedPages,
      };
    } else {
      // Specific page selected
      const updatedPages = ocrResult.pages.map((p, idx) => ({
        ...p,
        text: idx === selectedPageIndex ? editableText : p.text,
      }));

      const fullText = updatedPages
        .map((p) => (updatedPages.length > 1 ? `--- PÁGINA ${p.pageNumber} ---\n\n${p.text}` : p.text))
        .join('\n\n');

      return {
        ...ocrResult,
        pages: updatedPages,
        fullText,
      };
    }
  };

  const handleCopy = async () => {
    const textToCopy = editableText;
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
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

  const handleDownloadDocx = async () => {
    if (!file || !ocrResult) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    try {
      const resultToExport = getExportableOcrResult();
      const docxBlob = await exportOcrResultToDocx(resultToExport, {
        addPageBreaks: true,
      });
      downloadBlob(
        docxBlob,
        `${baseName}_ocr.docx`,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error al generar el documento Word (.docx).');
    }
  };

  const handleDownloadTxt = () => {
    if (!file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const textToDownload = editableText;
    const blob = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${baseName}_ocr.txt`, 'text/plain');
  };

  const handleDownloadPdf = async () => {
    if (!file || !ocrResult) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    try {
      const resultToExport = getExportableOcrResult();
      const pdfBytes = await exportOcrResultToPdf(resultToExport);
      downloadBlob(pdfBytes, `${baseName}_ocr.pdf`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error al generar el PDF digitalizado.');
    }
  };

  const handlePageTabChange = (target: number | 'all') => {
    if (!ocrResult) return;

    // Save current textarea changes to state before switching tab
    if (selectedPageIndex === 'all') {
      // Sync back to pages
      const updatedPages = ocrResult.pages.map((p) => {
        const regex = new RegExp(
          `--- PÁGINA ${p.pageNumber} ---\\s*\\n\\n([\\s\\S]*?)(?=(?:--- PÁGINA \\d+ ---|$))`,
          'i'
        );
        const match = editableText.match(regex);
        return match && match[1] !== undefined ? { ...p, text: match[1].trim() } : p;
      });
      setOcrResult({ ...ocrResult, fullText: editableText, pages: updatedPages });

      if (target === 'all') {
        setSelectedPageIndex('all');
      } else {
        setSelectedPageIndex(target);
        setEditableText(updatedPages[target]?.text || '');
      }
    } else {
      // Current tab was a single page
      const updatedPages = ocrResult.pages.map((p, idx) => ({
        ...p,
        text: idx === selectedPageIndex ? editableText : p.text,
      }));
      const fullText = updatedPages
        .map((p) => (updatedPages.length > 1 ? `--- PÁGINA ${p.pageNumber} ---\n\n${p.text}` : p.text))
        .join('\n\n');

      setOcrResult({ ...ocrResult, fullText, pages: updatedPages });

      if (target === 'all') {
        setSelectedPageIndex('all');
        setEditableText(fullText);
      } else {
        setSelectedPageIndex(target);
        setEditableText(updatedPages[target]?.text || '');
      }
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
  const wordCount = editableText.trim() ? editableText.trim().split(/\s+/).length : 0;
  const charCount = editableText.length;

  // Search matches count
  const searchMatches =
    searchTerm.trim().length > 1
      ? (editableText.match(new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length
      : 0;

  // Determine detection quality summary
  const hasDigitalPages = ocrResult?.pages.some((p) => p.method === 'digital');
  const allDigitalPages = ocrResult?.pages.every((p) => p.method === 'digital');
  const averageConfidence = ocrResult?.pages.length
    ? Math.round(ocrResult.pages.reduce((acc, p) => acc + p.confidence, 0) / ocrResult.pages.length)
    : 0;

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
          Convierte PDFs escaneados o imágenes en texto digital seleccionable y expórtalo directamente a Word (.docx), PDF o TXT.
        </p>

        {/* Badges */}
        <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-xs">
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            Exportación Word .DOCX nativa
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200/80 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
            Tesseract OCR 300 DPI + Redes LSTM
          </span>
          <a
            href="https://github.com/tesseract-ocr/tesseract"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 transition-colors"
            title="Ver repositorio oficial de Tesseract OCR en GitHub"
          >
            <span>tesseract-ocr</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        </div>
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

          <div className="space-y-5">
            {/* Language Selection */}
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

            {/* Recognition Mode Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-teal-600" />
                Modo de reconocimiento
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setOcrMode('hybrid')}
                  disabled={isProcessing}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    ocrMode === 'hybrid'
                      ? 'border-teal-500 bg-teal-50/60 ring-2 ring-teal-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className={`w-4 h-4 ${ocrMode === 'hybrid' ? 'text-teal-600' : 'text-slate-400'}`} />
                    <span className="font-bold text-sm text-slate-900">Modo Inteligente Híbrido</span>
                    <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Extrae texto digital nativo con precisión 100% si existe en el PDF, o aplica OCR neuronal a alta resolución si está escaneado.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setOcrMode('ocr')}
                  disabled={isProcessing}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    ocrMode === 'ocr'
                      ? 'border-teal-500 bg-teal-50/60 ring-2 ring-teal-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <ScanText className={`w-4 h-4 ${ocrMode === 'ocr' ? 'text-teal-600' : 'text-slate-400'}`} />
                    <span className="font-bold text-sm text-slate-900">Forzar Tesseract OCR</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Aplica la red neuronal OCR de Tesseract a todas las páginas a 300 DPI (ideal para fotos o escaneos fotocopiados).
                  </p>
                </button>
              </div>
            </div>

            {/* Quality Preprocessing Checkbox */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-teal-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Realce de contraste y nitidez (300 DPI)
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Elimina fondos amarillos o grises de escáner y aumenta drásticamente la precisión del texto.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                aria-label="Realzar contraste y nitidez"
                checked={enhanceContrast}
                onChange={(e) => setEnhanceContrast(e.target.checked)}
                disabled={isProcessing}
                className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
              />
            </div>

            {/* Progress Bar */}
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
                  <span>Comenzar Reconocimiento OCR</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Results View */
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          {/* Header Actions */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 bg-teal-100 text-teal-800 text-xs font-extrabold uppercase rounded-lg">
                  Texto Reconocido
                </span>
                {allDigitalPages ? (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-md border border-emerald-200">
                    Texto Digital 100% Precisión
                  </span>
                ) : hasDigitalPages ? (
                  <span className="px-2 py-0.5 bg-teal-50 text-teal-700 text-xs font-semibold rounded-md border border-teal-200">
                    Híbrido (Digital + OCR)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md border border-slate-200">
                    Tesseract OCR Neuronal
                  </span>
                )}
                <span className="text-xs text-slate-500">
                  {ocrResult.pages.length} {ocrResult.pages.length === 1 ? 'página' : 'páginas'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1 truncate max-w-sm sm:max-w-md">
                {file.name}
              </h2>
            </div>

            {/* Export Buttons: Word (.docx), PDF, TXT, Copy */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
              </button>

              <button
                onClick={handleDownloadDocx}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#185abd] hover:bg-[#124592] text-white text-xs font-bold rounded-xl shadow-md shadow-blue-900/20 transition-[background-color,box-shadow] cursor-pointer"
                title="Descargar como documento de Microsoft Word (.docx) 100% editable"
              >
                <FileText className="w-4 h-4" />
                <span>Descargar Word (.docx)</span>
              </button>

              <button
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md shadow-slate-900/20 transition-[background-color,box-shadow] cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Descargar PDF</span>
              </button>

              <button
                onClick={handleDownloadTxt}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-md shadow-teal-600/20 transition-[background-color,box-shadow] cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Descargar TXT</span>
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
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600 w-full sm:w-auto">
              <span>{wordCount} palabras</span>
              <span>•</span>
              <span>{charCount} caracteres</span>
              {ocrResult.pages.length > 0 && (
                <>
                  <span>•</span>
                  <span>
                    Confianza media: {averageConfidence}%
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
                className="w-full pl-9 pr-12 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
              {searchTerm && (
                <span className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[10px] font-bold text-slate-400">
                  {searchMatches} {searchMatches === 1 ? 'coincidencia' : 'coincidencias'}
                </span>
              )}
            </div>
          </div>

          {/* Page Tabs if multi-page */}
          {ocrResult.pages.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-100">
              <button
                onClick={() => handlePageTabChange('all')}
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
                  onClick={() => handlePageTabChange(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                    selectedPageIndex === idx
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>Pág {p.pageNumber}</span>
                  {p.method === 'digital' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Texto digital nativo"></span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Text Area */}
          <div>
            <textarea
              aria-label="Contenido del texto reconocido por OCR"
              value={editableText}
              onChange={(e) => setEditableText(e.target.value)}
              rows={16}
              className="w-full p-4 font-mono text-sm leading-relaxed bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none resize-y text-slate-800"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 pt-2">
            <span className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-400" />
              Puedes editar el texto directamente en el recuadro antes de copiar o descargar en Word (.docx), PDF o TXT.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
