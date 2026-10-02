import React, { useState } from 'react';
import {
  Split,
  Layers,
  CheckSquare,
  Square,
  Download,
  Loader2,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { Dropzone } from '../components/Dropzone';
import { SuccessView } from '../components/SuccessView';
import {
  splitPdf,
  extractAllThumbnails,
  createZip,
  downloadBlob,
} from '../utils/pdfUtils';
import type { PageInfo } from '../types';

interface SplitToolProps {
  onHome: () => void;
}

export const SplitTool: React.FC<SplitToolProps> = ({ onHome }) => {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [splitMode, setSplitMode] = useState<'extract' | 'ranges' | 'all'>('extract');
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [rangeString, setRangeString] = useState<string>('1-2');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedResults, setGeneratedResults] = useState<{ name: string; data: Uint8Array }[] | null>(null);

  const selectedSet = React.useMemo(() => new Set(selectedPages), [selectedPages]);

  const handleFileSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
    setFile(f);
    setErrorMsg(null);
    setIsLoadingPages(true);

    try {
      const buffer = await f.arrayBuffer();
      const extracted = await extractAllThumbnails(buffer);
      setPages(extracted);
      // Select first page by default
      if (extracted.length > 0) {
        setSelectedPages([1]);
        if (extracted.length >= 2) {
          setRangeString(`1-${Math.min(3, extracted.length)}`);
        } else {
          setRangeString('1');
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('No se pudo cargar la vista previa del archivo PDF.');
    } finally {
      setIsLoadingPages(false);
    }
  };

  const togglePageSelection = (pageNum: number) => {
    setSelectedPages((prev) =>
      prev.includes(pageNum) ? prev.filter((p) => p !== pageNum) : [...prev, pageNum].sort((a, b) => a - b)
    );
  };

  const selectAllPages = () => {
    setSelectedPages(pages.map((p) => p.pageNumber));
  };

  const deselectAllPages = () => {
    setSelectedPages([]);
  };

  const handleSplit = async () => {
    if (!file) return;

    if (splitMode === 'extract' && selectedPages.length === 0) {
      setErrorMsg('Por favor selecciona al menos una página para extraer.');
      return;
    }

    if (splitMode === 'ranges' && !rangeString.trim()) {
      setErrorMsg('Por favor introduce al menos un rango (ej: 1-3, 4-5).');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const freshBuffer = await file.arrayBuffer();
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const results = await splitPdf(freshBuffer, splitMode, {
        ranges: rangeString,
        selectedPages,
        baseName,
      });
      setGeneratedResults(results);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Error al dividir el PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedResults) return;

    if (generatedResults.length === 1) {
      downloadBlob(generatedResults[0].data, generatedResults[0].name);
    } else {
      // Multiple files -> Zip
      const zipBlob = await createZip(
        generatedResults.map((r) => ({ name: r.name, blob: r.data }))
      );
      const baseName = file?.name.replace(/\.[^/.]+$/, '') || 'paginas_divididas';
      downloadBlob(zipBlob, `${baseName}_dividido.zip`, 'application/zip');
    }
  };

  const handleReset = () => {
    setFile(null);
    setPages([]);
    setGeneratedResults(null);
    setSelectedPages([]);
    setErrorMsg(null);
  };

  if (generatedResults) {
    const isZip = generatedResults.length > 1;
    return (
      <SuccessView
        title="¡Tu PDF se ha dividido con éxito!"
        subtitle={
          isZip
            ? `Se han creado ${generatedResults.length} archivos individuales en un archivo comprimido .ZIP.`
            : `Se ha generado el nuevo archivo con las páginas solicitadas.`
        }
        onDownload={handleDownload}
        onReset={handleReset}
        onHome={onHome}
        downloadLabel={isZip ? 'Descargar Archivos (.ZIP)' : 'Descargar PDF Extraído'}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Tool Title */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 mb-3 shadow-inner">
          <Split className="w-7 h-7" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Dividir archivo PDF
        </h1>
        <p className="text-slate-500 mt-2 text-base">
          Extrae páginas sueltas o divide tu PDF en rangos con vista previa visual.
        </p>
      </div>

      {!file ? (
        <Dropzone
          onFilesSelected={handleFileSelected}
          multiple={false}
          title="Seleccionar archivo PDF"
          subtitle="o arrastra un PDF aquí para extraer sus páginas"
        />
      ) : isLoadingPages ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-xs">
          <Loader2 className="w-10 h-10 text-brand-600 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800">Cargando páginas del documento...</h3>
          <p className="text-slate-400 text-sm mt-1">Generando vistas previas de alta resolución</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Options Header Bar */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
            <h3 className="font-bold text-slate-900 text-base mb-4">Elige cómo dividir tu PDF</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label
                onClick={() => setSplitMode('extract')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  splitMode === 'extract'
                    ? 'border-brand-500 bg-brand-50/40 text-brand-900'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm">Extraer páginas</span>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${splitMode === 'extract' ? 'border-brand-600 bg-brand-600' : 'border-slate-300'}`}>
                    {splitMode === 'extract' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Selecciona con un clic las páginas que deseas reunir en un nuevo PDF.
                </p>
              </label>

              <label
                onClick={() => setSplitMode('ranges')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  splitMode === 'ranges'
                    ? 'border-brand-500 bg-brand-50/40 text-brand-900'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm">Dividir por rangos</span>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${splitMode === 'ranges' ? 'border-brand-600 bg-brand-600' : 'border-slate-300'}`}>
                    {splitMode === 'ranges' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Crea varios PDFs a partir de intervalos como 1-3, 4-6, etc.
                </p>
              </label>

              <label
                onClick={() => setSplitMode('all')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  splitMode === 'all'
                    ? 'border-brand-500 bg-brand-50/40 text-brand-900'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm">Separar todas las páginas</span>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${splitMode === 'all' ? 'border-brand-600 bg-brand-600' : 'border-slate-300'}`}>
                    {splitMode === 'all' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Convierte cada página en un archivo PDF independiente (se descargará en ZIP).
                </p>
              </label>
            </div>

            {/* Mode-specific configuration inputs */}
            {splitMode === 'ranges' && (
              <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-4">
                <div className="w-full sm:w-auto">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rangos de páginas (separados por comas):
                  </label>
                  <input
                    type="text"
                    aria-label="Rangos de páginas a dividir"
                    value={rangeString}
                    onChange={(e) => setRangeString(e.target.value)}
                    placeholder="ej: 1-3, 4-5"
                    className="w-full sm:w-64 px-4 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                  />
                </div>
                <p className="text-xs text-slate-400 self-end mb-2">
                  Total de páginas del documento: {pages.length}
                </p>
              </div>
            )}

            {splitMode === 'extract' && (
              <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-700">
                  {selectedPages.length} de {pages.length} páginas seleccionadas
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAllPages}
                    className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
                  >
                    Seleccionar todas
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={deselectAllPages}
                    className="text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                  >
                    Deseleccionar todas
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Visual Thumbnails Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {pages.map((p) => {
              const isSelected = selectedSet.has(p.pageNumber);
              return (
                <div
                  key={p.pageNumber}
                  onClick={() => splitMode === 'extract' && togglePageSelection(p.pageNumber)}
                  className={`group relative bg-white rounded-2xl p-2 border-2 transition-[border-color,box-shadow] ${
                    splitMode === 'extract' ? 'cursor-pointer' : ''
                  } ${
                    splitMode === 'extract' && isSelected
                      ? 'border-brand-500 shadow-md shadow-brand-500/10 ring-2 ring-brand-400/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="relative aspect-3/4 rounded-xl overflow-hidden bg-slate-100 border border-slate-100 flex items-center justify-center">
                    <img
                      src={p.thumbnailUrl}
                      alt={`Página ${p.pageNumber}`}
                      className="w-full h-full object-contain"
                    />

                    {/* Checkbox indicator for extract mode */}
                    {splitMode === 'extract' && (
                      <div className="absolute top-2 right-2">
                        {isSelected ? (
                          <div className="w-6 h-6 rounded-md bg-brand-600 text-white flex items-center justify-center shadow-xs">
                            <CheckSquare className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-md bg-white/90 text-slate-400 border border-slate-300 flex items-center justify-center opacity-70 group-hover:opacity-100">
                            <Square className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 text-center text-xs font-semibold text-slate-600">
                    Página {p.pageNumber}
                  </div>
                </div>
              );
            })}
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
              <FileCheck className="w-4 h-4 text-emerald-500" />
              <span className="font-semibold text-slate-700 truncate max-w-xs">{file.name}</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl transition-colors cursor-pointer"
              >
                Cambiar archivo
              </button>

              <button
                onClick={handleSplit}
                disabled={isProcessing}
                className="inline-flex items-center gap-2 px-8 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-base rounded-xl shadow-lg shadow-brand-600/30 transition-[background-color,box-shadow] cursor-pointer disabled:bg-slate-300"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Dividiendo...</span>
                  </>
                ) : (
                  <>
                    <Split className="w-5 h-5" />
                    <span>Dividir PDF</span>
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
