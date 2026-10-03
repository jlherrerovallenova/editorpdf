import React, { useState } from 'react';
import {
  Hash,
  FileCheck,
  Loader2,
  AlertCircle,
  Eye,
  Sliders,
} from 'lucide-react';
import { Dropzone } from '../components/Dropzone';
import { SuccessView } from '../components/SuccessView';
import {
  addPageNumbersToPdf,
  downloadBlob,
  renderPdfPageToDataUrl,
  getPdfJsDocument,
  formatPageNumber,
  type PageNumberOptions,
} from '../utils/pdfUtils';

interface PageNumberToolProps {
  onHome: () => void;
}

const POSITIONS = [
  { id: 'top-left', label: 'Encabezado Izq.', row: 'top', col: 'left' },
  { id: 'top-center', label: 'Encabezado Centro', row: 'top', col: 'center' },
  { id: 'top-right', label: 'Encabezado Der.', row: 'top', col: 'right' },
  { id: 'bottom-left', label: 'Pie Izq.', row: 'bottom', col: 'left' },
  { id: 'bottom-center', label: 'Pie Centro', row: 'bottom', col: 'center' },
  { id: 'bottom-right', label: 'Pie Der.', row: 'bottom', col: 'right' },
] as const;

const FORMATS = [
  { id: 'n', label: 'Solo número (1)' },
  { id: 'n_of_total', label: 'Número y total (1 / 10)' },
  { id: 'page_n', label: 'Página X (Página 1)' },
  { id: 'page_n_of_total', label: 'Página X de Y (Página 1 de 10)' },
  { id: 'pag_n', label: 'Pág. X (Pág. 1)' },
  { id: 'pag_n_of_total', label: 'Pág. X de Y (Pág. 1 de 10)' },
] as const;

export const PageNumberTool: React.FC<PageNumberToolProps> = ({ onHome }) => {
  const [file, setFile] = useState<File | null>(null);
  const [pagePreviewUrl, setPagePreviewUrl] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [position, setPosition] = useState<PageNumberOptions['position']>('bottom-center');
  const [format, setFormat] = useState<PageNumberOptions['format']>('page_n_of_total');
  const [startPage, setStartPage] = useState<number>(1);
  const [fontSize, setFontSize] = useState<number>(10);
  const [colorHex, setColorHex] = useState<string>('#334155');
  const [margin, setMargin] = useState<number>(30);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultData, setResultData] = useState<Uint8Array | null>(null);

  const handleFileSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const selected = files[0];
    setFile(selected);
    setErrorMsg(null);

    try {
      const buffer = await selected.arrayBuffer();
      const [rendered, pdfDoc] = await Promise.all([
        renderPdfPageToDataUrl(buffer, 1, 0.8),
        getPdfJsDocument(buffer),
      ]);
      setPagePreviewUrl(rendered.dataUrl);
      setTotalPages(pdfDoc.numPages);
    } catch (err: any) {
      console.warn('Could not render thumbnail:', err);
    }
  };

  const handleApply = async () => {
    if (!file) return;

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const freshBuffer = await file.arrayBuffer();
      const options: PageNumberOptions = {
        position,
        format,
        fontSize,
        colorHex,
        margin,
        startPage,
        startNumber: 1,
      };

      const numberedBytes = await addPageNumbersToPdf(freshBuffer, options);
      setResultData(numberedBytes);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Error al aplicar los números de página.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultData || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    downloadBlob(resultData, `${baseName}_numerado.pdf`);
  };

  const handleReset = () => {
    setFile(null);
    setPagePreviewUrl(null);
    setResultData(null);
    setErrorMsg(null);
  };

  // Preview formatted text for page 1
  const previewSampleText = formatPageNumber(0, totalPages, {
    position,
    format,
    fontSize,
    colorHex,
    margin,
    startPage,
    startNumber: 1,
  });

  if (resultData) {
    return (
      <SuccessView
        title="¡Tu PDF ha sido numerado con éxito!"
        subtitle="Se han insertado los números de página en la posición y formato que elegiste."
        onDownload={handleDownload}
        onReset={handleReset}
        onHome={onHome}
        downloadLabel="Descargar PDF Numerado"
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Title */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sky-100 text-sky-600 mb-3 shadow-inner">
          <Hash className="w-7 h-7" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Numerar Páginas del PDF
        </h1>
        <p className="text-slate-500 mt-2 text-base max-w-xl mx-auto">
          Añade numeración personalizada a tus documentos PDF con total control de estilo, posición y saltos de portada.
        </p>
      </div>

      {!file ? (
        <Dropzone
          onFilesSelected={handleFileSelected}
          multiple={false}
          title="Seleccionar archivo PDF"
          subtitle="o arrastra un PDF aquí para añadir números de página"
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Controls Panel */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
                  <FileCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate max-w-xs">
                    {file.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {totalPages} {totalPages === 1 ? 'página detectada' : 'páginas detectadas'} • Listo para numerar
                  </p>
                </div>
              </div>

              <button
                onClick={handleReset}
                className="text-xs font-semibold text-slate-500 hover:text-red-600 cursor-pointer"
              >
                Cambiar archivo
              </button>
            </div>

            {/* Position Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-sky-600" />
                Posición en la página
              </label>

              {/* 3x2 Grid */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                {POSITIONS.map((pos) => {
                  const isSelected = position === pos.id;
                  return (
                    <button
                      type="button"
                      key={pos.id}
                      onClick={() => setPosition(pos.id)}
                      className={`p-3 rounded-xl text-xs font-bold transition-[background-color,border-color,box-shadow] cursor-pointer text-center flex flex-col items-center justify-center gap-1.5 border ${
                        isSelected
                          ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-600/20'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-sky-300'
                      }`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded-full border-2 ${
                          isSelected ? 'border-white bg-white/40' : 'border-slate-300'
                        }`}
                      />
                      <span>{pos.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Format Selector */}
            <div>
              <label
                htmlFor="page-number-format-select"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
              >
                Formato de numeración
              </label>
              <select
                id="page-number-format-select"
                aria-label="Formato de numeración"
                value={format}
                onChange={(e) => setFormat(e.target.value as any)}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-none"
              >
                {FORMATS.map((fmt) => (
                  <option key={fmt.id} value={fmt.id}>
                    {fmt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* First Page (Skip Cover) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="start-page-select"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
                >
                  Página de inicio
                </label>
                <select
                  id="start-page-select"
                  aria-label="Página de inicio"
                  value={startPage}
                  onChange={(e) => setStartPage(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                >
                  <option value={1}>Página 1 (Todo el documento)</option>
                  <option value={2}>Página 2 (Omitir portada)</option>
                  <option value={3}>Página 3</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="font-size-select"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
                >
                  Tamaño de fuente
                </label>
                <select
                  id="font-size-select"
                  aria-label="Tamaño de fuente"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                >
                  <option value={9}>Pequeño (9 pt)</option>
                  <option value={11}>Mediano (11 pt)</option>
                  <option value={14}>Grande (14 pt)</option>
                </select>
              </div>
            </div>

            {/* Color & Margin */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Color del texto
                </label>
                <div className="flex items-center gap-2">
                  {[
                    { color: '#1e293b', name: 'Negro' },
                    { color: '#475569', name: 'Gris' },
                    { color: '#2563eb', name: 'Azul' },
                    { color: '#dc2626', name: 'Rojo' },
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => setColorHex(c.color)}
                      aria-label={`Color ${c.name}`}
                      style={{ backgroundColor: c.color }}
                      className={`w-9 h-9 rounded-xl border-2 transition-transform cursor-pointer ${
                        colorHex === c.color
                          ? 'border-sky-500 scale-110 shadow-sm'
                          : 'border-transparent hover:scale-105'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="margin-slider"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
                >
                  Margen: {margin} pt
                </label>
                <input
                  id="margin-slider"
                  type="range"
                  aria-label="Margen del número de página"
                  min="15"
                  max="60"
                  step="5"
                  value={margin}
                  onChange={(e) => setMargin(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 border border-red-200 rounded-2xl text-sm font-semibold">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              onClick={handleApply}
              disabled={isProcessing}
              className="w-full inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-lg rounded-2xl shadow-xl shadow-sky-600/25 transition-[background-color,box-shadow] cursor-pointer disabled:bg-slate-300"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Insertando números...</span>
                </>
              ) : (
                <>
                  <Hash className="w-5 h-5" />
                  <span>Numerar PDF</span>
                </>
              )}
            </button>
          </div>

          {/* Interactive Live Page Preview */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-sky-600" />
                Vista previa en vivo
              </span>
              <span className="text-xs font-medium text-slate-500">Hoja A4</span>
            </div>

            {/* Sheet representation */}
            <div className="relative mx-auto aspect-[1/1.414] max-w-[280px] bg-slate-50 border-2 border-slate-200 rounded-xl shadow-inner flex flex-col justify-between p-4 overflow-hidden">
              {/* Optional Background Thumbnail */}
              {pagePreviewUrl && (
                <img
                  src={pagePreviewUrl}
                  alt="Vista previa de página"
                  className="absolute inset-0 w-full h-full object-contain opacity-30 pointer-events-none"
                />
              )}

              {/* Top Row Positions */}
              <div className="flex items-center justify-between z-10">
                <div
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    position === 'top-left' ? 'bg-sky-600 text-white ring-2 ring-sky-300 shadow-sm' : 'text-slate-300'
                  }`}
                >
                  {position === 'top-left' ? previewSampleText : '•••'}
                </div>
                <div
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    position === 'top-center' ? 'bg-sky-600 text-white ring-2 ring-sky-300 shadow-sm' : 'text-slate-300'
                  }`}
                >
                  {position === 'top-center' ? previewSampleText : '•••'}
                </div>
                <div
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    position === 'top-right' ? 'bg-sky-600 text-white ring-2 ring-sky-300 shadow-sm' : 'text-slate-300'
                  }`}
                >
                  {position === 'top-right' ? previewSampleText : '•••'}
                </div>
              </div>

              {/* Fake Content Lines for visual context */}
              <div className="space-y-2 z-10 px-2 opacity-30">
                <div className="h-2 bg-slate-300 rounded-full w-3/4" />
                <div className="h-2 bg-slate-200 rounded-full w-full" />
                <div className="h-2 bg-slate-200 rounded-full w-5/6" />
                <div className="h-2 bg-slate-200 rounded-full w-2/3" />
                <div className="h-2 bg-slate-200 rounded-full w-4/5" />
              </div>

              {/* Bottom Row Positions */}
              <div className="flex items-center justify-between z-10">
                <div
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    position === 'bottom-left' ? 'bg-sky-600 text-white ring-2 ring-sky-300 shadow-sm' : 'text-slate-300'
                  }`}
                >
                  {position === 'bottom-left' ? previewSampleText : '•••'}
                </div>
                <div
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    position === 'bottom-center' ? 'bg-sky-600 text-white ring-2 ring-sky-300 shadow-sm' : 'text-slate-300'
                  }`}
                >
                  {position === 'bottom-center' ? previewSampleText : '•••'}
                </div>
                <div
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    position === 'bottom-right' ? 'bg-sky-600 text-white ring-2 ring-sky-300 shadow-sm' : 'text-slate-300'
                  }`}
                >
                  {position === 'bottom-right' ? previewSampleText : '•••'}
                </div>
              </div>
            </div>

            <div className="text-center text-xs text-slate-500 font-medium">
              Texto seleccionado: <span className="font-bold text-slate-800">"{previewSampleText}"</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
