import React, { useState } from 'react';
import {
  FileText,
  FileCheck,
  Loader2,
  AlertCircle,
  Sparkles,
  Zap,
  Languages,
  Check,
  FileCode,
} from 'lucide-react';
import { Dropzone } from '../components/Dropzone';
import { SuccessView } from '../components/SuccessView';
import {
  convertPdfToWord,
  downloadBlob,
  formatFileSize,
  type PdfToWordOptions,
  type PdfToWordResult,
} from '../utils/pdfUtils';

interface PdfToWordToolProps {
  onHome: () => void;
}

const OCR_LANGUAGES = [
  { code: 'spa', label: 'Español' },
  { code: 'eng', label: 'English' },
  { code: 'fra', label: 'Français' },
  { code: 'deu', label: 'Deutsch' },
  { code: 'ita', label: 'Italiano' },
  { code: 'por', label: 'Português' },
];

export const PdfToWordTool: React.FC<PdfToWordToolProps> = ({ onHome }) => {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<PdfToWordOptions['mode']>('auto');
  const [ocrLanguage, setOcrLanguage] = useState<string>('spa');
  const [detectHeadings, setDetectHeadings] = useState<boolean>(true);
  const [addPageBreaks, setAddPageBreaks] = useState<boolean>(true);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');
  const [progressPct, setProgressPct] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<PdfToWordResult | null>(null);

  const handleFileSelected = (files: File[]) => {
    if (files.length === 0) return;
    setFile(files[0]);
    setErrorMsg(null);
    setResult(null);
  };

  const handleConvert = async () => {
    if (!file) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setProgressPct(5);
    setProgressText('Iniciando extracción de documento...');

    try {
      const buffer = await file.arrayBuffer();
      const options: PdfToWordOptions = {
        mode,
        language: ocrLanguage,
        detectHeadings,
        addPageBreaks,
      };

      const res = await convertPdfToWord(buffer, options, (text, pct) => {
        setProgressText(text);
        setProgressPct(pct);
      });

      setResult(res);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Error al convertir el archivo PDF a Word.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    downloadBlob(
      result.docxBlob,
      `${baseName}.docx`,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setProgressPct(0);
    setProgressText('');
    setErrorMsg(null);
  };

  if (result) {
    return (
      <SuccessView
        title="¡Tu documento Word (.docx) está listo!"
        subtitle="Se ha convertido con éxito y es 100% editable en Microsoft Word, Google Docs o LibreOffice."
        onDownload={handleDownload}
        onReset={handleReset}
        onHome={onHome}
        downloadLabel="Descargar Documento Word (.docx)"
        stats={{
          pageCount: result.pageCount,
          newSize: result.docxBlob.size,
        }}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Title */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sky-100 text-sky-700 mb-3 shadow-inner">
          <FileText className="w-7 h-7" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Convertir PDF a Word
        </h1>
        <p className="text-slate-500 mt-2 text-base max-w-xl mx-auto">
          Transforma tu PDF en un archivo .DOCX totalmente editable manteniendo párrafos, encabezados y formato.
        </p>
      </div>

      {!file ? (
        <Dropzone
          onFilesSelected={handleFileSelected}
          multiple={false}
          title="Seleccionar archivo PDF para convertir a Word"
          subtitle="o arrastra tu documento PDF aquí para generar un .DOCX editable"
        />
      ) : (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          {/* File Selected Card */}
          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700">
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
              type="button"
              onClick={handleReset}
              disabled={isProcessing}
              className="text-xs font-semibold text-slate-500 hover:text-red-600 cursor-pointer disabled:opacity-50"
            >
              Cambiar archivo
            </button>
          </div>

          {/* Mode Selector */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Modo de conversión
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Auto / Vector */}
              <button
                type="button"
                onClick={() => setMode('auto')}
                className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-[background-color,border-color,box-shadow] cursor-pointer ${
                  mode === 'auto'
                    ? 'border-sky-600 bg-sky-50/70 ring-1 ring-sky-500'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                    mode === 'auto'
                      ? 'border-sky-600 bg-sky-600 text-white'
                      : 'border-slate-300'
                  }`}
                >
                  {mode === 'auto' && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                    <Zap className="w-4 h-4 text-sky-600" />
                    <span>Estándar (Rápido)</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Extrae texto seleccionable nativo con estructura de párrafos e identificación de títulos.
                  </p>
                </div>
              </button>

              {/* Option 2: OCR */}
              <button
                type="button"
                onClick={() => setMode('ocr')}
                className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-[background-color,border-color,box-shadow] cursor-pointer ${
                  mode === 'ocr'
                    ? 'border-sky-600 bg-sky-50/70 ring-1 ring-sky-500'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                    mode === 'ocr'
                      ? 'border-sky-600 bg-sky-600 text-white'
                      : 'border-slate-300'
                  }`}
                >
                  {mode === 'ocr' && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                    <Sparkles className="w-4 h-4 text-teal-600" />
                    <span>Con OCR IA (Escaneados)</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Usa visión óptica para extraer texto de PDFs escaneados o imágenes fotografiadas.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* OCR Language Selector if OCR is chosen */}
          {mode === 'ocr' && (
            <div className="p-4 bg-teal-50/60 border border-teal-100 rounded-2xl space-y-2">
              <label
                htmlFor="word-ocr-language-select"
                className="block text-xs font-bold text-teal-900 uppercase tracking-wider flex items-center gap-1.5"
              >
                <Languages className="w-4 h-4 text-teal-600" />
                Idioma del texto escaneado
              </label>
              <select
                id="word-ocr-language-select"
                aria-label="Idioma del texto escaneado"
                value={ocrLanguage}
                onChange={(e) => setOcrLanguage(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-teal-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              >
                {OCR_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label} ({l.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Layout Formatting Checkboxes */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                aria-label="Detectar encabezados y títulos automáticamente"
                checked={detectHeadings}
                onChange={(e) => setDetectHeadings(e.target.checked)}
                className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500 cursor-pointer"
              />
              <span>Detectar títulos y encabezados automáticamente (Heading 1 y 2 en Word)</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                aria-label="Insertar saltos de página entre páginas del PDF"
                checked={addPageBreaks}
                onChange={(e) => setAddPageBreaks(e.target.checked)}
                className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500 cursor-pointer"
              />
              <span>Insertar salto de página entre cada página original del PDF</span>
            </label>
          </div>

          {/* Privacy Note */}
          <div className="p-4 bg-sky-50/70 border border-sky-100 rounded-2xl flex items-start gap-3 text-xs text-sky-950">
            <FileCode className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
            <p>
              El archivo Word (.docx) se compila localmente en formato OpenXML estándar. Es 100% compatible con Microsoft Word (versiones de escritorio y web), Google Docs y LibreOffice.
            </p>
          </div>

          {/* Progress Indicator */}
          {isProcessing && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                  {progressText || 'Procesando...'}
                </span>
                <span className="text-sky-600 font-extrabold">{progressPct}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-sky-600 h-full rounded-full transition-[width] duration-300 ease-out"
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

          {/* Convert Button */}
          <button
            type="button"
            onClick={handleConvert}
            disabled={isProcessing}
            className="w-full inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-[#2b579a] hover:bg-[#20447c] text-white font-extrabold text-lg rounded-2xl shadow-xl shadow-[#2b579a]/25 transition-[background-color,box-shadow] cursor-pointer disabled:bg-slate-300"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Generando documento Word...</span>
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                <span>Convertir a Word (.DOCX)</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
