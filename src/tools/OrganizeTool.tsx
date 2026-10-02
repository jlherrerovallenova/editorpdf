import React, { useState } from 'react';
import {
  Layers,
  RotateCw,
  RotateCcw,
  Trash2,
  Undo2,
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { Dropzone } from '../components/Dropzone';
import { SuccessView } from '../components/SuccessView';
import { extractAllThumbnails, organizePdf, downloadBlob } from '../utils/pdfUtils';

interface PageItem {
  id: string;
  originalIndex: number; // 0-based
  displayNumber: number; // original 1-based page number
  rotation: number; // 0, 90, 180, 270
  thumbnailUrl: string;
  isDeleted: boolean;
}

interface OrganizeToolProps {
  onHome: () => void;
}

export const OrganizeTool: React.FC<OrganizeToolProps> = ({ onHome }) => {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultData, setResultData] = useState<Uint8Array | null>(null);

  const handleFileSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
    setFile(f);
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const buffer = await f.arrayBuffer();
      const thumbs = await extractAllThumbnails(buffer);
      const items: PageItem[] = thumbs.map((t, idx) => ({
        id: `page-${idx}`,
        originalIndex: idx,
        displayNumber: t.pageNumber,
        rotation: 0,
        thumbnailUrl: t.thumbnailUrl,
        isDeleted: false,
      }));
      setPages(items);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('No se pudo cargar el documento PDF.');
    } finally {
      setIsLoading(false);
    }
  };

  const rotatePage = (id: string, delta: number) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const newRot = (p.rotation + delta + 360) % 360;
        return { ...p, rotation: newRot };
      })
    );
  };

  const toggleDelete = (id: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isDeleted: !p.isDeleted } : p))
    );
  };

  const movePage = (index: number, direction: 'left' | 'right') => {
    if (direction === 'left' && index === 0) return;
    if (direction === 'right' && index === pages.length - 1) return;

    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    const copy = [...pages];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);
    setPages(copy);
  };

  const rotateAll = (delta: number) => {
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        rotation: (p.rotation + delta + 360) % 360,
      }))
    );
  };

  const resetAll = () => {
    setPages((prev) =>
      [...prev]
        .sort((a, b) => a.originalIndex - b.originalIndex)
        .map((p) => ({
          ...p,
          rotation: 0,
          isDeleted: false,
        }))
    );
  };

  const handleSave = async () => {
    if (!file) return;

    const remainingPages = pages.filter((p) => !p.isDeleted);
    if (remainingPages.length === 0) {
      setErrorMsg('No puedes eliminar todas las páginas del documento.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const freshBuffer = await file.arrayBuffer();
      const output = await organizePdf(
        freshBuffer,
        pages.map((p) => ({
          originalIndex: p.originalIndex,
          rotation: p.rotation,
          isDeleted: p.isDeleted,
        }))
      );
      setResultData(output);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Error al reorganizar el PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultData || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    downloadBlob(resultData, `${baseName}_organizado.pdf`);
  };

  const handleReset = () => {
    setFile(null);
    setPages([]);
    setResultData(null);
    setErrorMsg(null);
  };

  if (resultData) {
    const activePagesCount = pages.filter((p) => !p.isDeleted).length;
    return (
      <SuccessView
        title="¡Tu PDF ha sido organizado!"
        subtitle={`El documento final contiene ${activePagesCount} páginas organizadas y orientadas según tus preferencias.`}
        onDownload={handleDownload}
        onReset={handleReset}
        onHome={onHome}
        downloadLabel="Descargar PDF Organizado"
      />
    );
  }

  const activeCount = pages.filter((p) => !p.isDeleted).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Tool Title */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 mb-3 shadow-inner">
          <Layers className="w-7 h-7" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Organizar y Rotar páginas PDF
        </h1>
        <p className="text-slate-500 mt-2 text-base">
          Ordena visualmente las páginas, rótalas o elimina las que no necesites.
        </p>
      </div>

      {!file ? (
        <Dropzone
          onFilesSelected={handleFileSelected}
          multiple={false}
          title="Seleccionar archivo PDF"
          subtitle="o arrastra un PDF aquí para ordenar sus páginas"
        />
      ) : isLoading ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-xs">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800">Cargando páginas para organizar...</h3>
          <p className="text-slate-400 text-sm mt-1">Generando cuadrícula interactiva</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Action toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-800">
                {activeCount} de {pages.length} páginas visibles
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => rotateAll(90)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5 text-orange-600" />
                Rotar todas +90°
              </button>

              <button
                onClick={resetAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5 text-slate-600" />
                Restablecer orden
              </button>
            </div>
          </div>

          {/* Interactive Page Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {pages.map((p, index) => (
              <div
                key={p.id}
                className={`group relative bg-white rounded-2xl p-3 border-2 transition-all flex flex-col justify-between ${
                  p.isDeleted
                    ? 'opacity-40 border-red-200 bg-red-50/20'
                    : 'border-slate-200 hover:border-orange-400 hover:shadow-md'
                }`}
              >
                {/* Thumbnail with rotation applied */}
                <div className="relative aspect-3/4 rounded-xl overflow-hidden bg-slate-100 border border-slate-100 flex items-center justify-center p-1">
                  <img
                    src={p.thumbnailUrl}
                    alt={`Página ${p.displayNumber}`}
                    style={{
                      transform: `rotate(${p.rotation}deg)`,
                      transition: 'transform 0.2s ease-in-out',
                    }}
                    className="max-w-full max-h-full object-contain"
                  />

                  {/* Deleted overlay badge */}
                  {p.isDeleted && (
                    <div className="absolute inset-0 bg-red-950/40 backdrop-blur-[1px] flex items-center justify-center">
                      <span className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-lg shadow-sm">
                        Eliminada
                      </span>
                    </div>
                  )}

                  {/* Page number badge */}
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-slate-900/70 text-white text-[11px] font-bold rounded-md">
                    {index + 1} ({p.displayNumber})
                  </div>
                </div>

                {/* Card Controls */}
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                  {/* Left / Right move */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => movePage(index, 'left')}
                      disabled={index === 0}
                      className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md disabled:opacity-20 cursor-pointer"
                      title="Mover a la izquierda"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => movePage(index, 'right')}
                      disabled={index === pages.length - 1}
                      className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md disabled:opacity-20 cursor-pointer"
                      title="Mover a la derecha"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Rotate & Delete */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => rotatePage(p.id, 90)}
                      disabled={p.isDeleted}
                      className="p-1 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-md cursor-pointer disabled:opacity-20"
                      title="Rotar 90° horario"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => toggleDelete(p.id)}
                      className={`p-1 rounded-md transition-colors cursor-pointer ${
                        p.isDeleted
                          ? 'text-emerald-600 hover:bg-emerald-50'
                          : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                      }`}
                      title={p.isDeleted ? 'Recuperar página' : 'Eliminar página'}
                    >
                      {p.isDeleted ? <Undo2 className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
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
                onClick={handleSave}
                disabled={isProcessing || activeCount === 0}
                className="inline-flex items-center gap-2 px-8 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-base rounded-xl shadow-lg shadow-brand-600/30 transition-[background-color,box-shadow] cursor-pointer disabled:bg-slate-300"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Guardando cambios...</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-5 h-5" />
                    <span>Guardar y Descargar PDF</span>
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
