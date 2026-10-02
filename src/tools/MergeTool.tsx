import React, { useState } from 'react';
import {
  Combine,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  FileText,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Dropzone } from '../components/Dropzone';
import { SuccessView } from '../components/SuccessView';
import { mergePdfs, downloadBlob, formatFileSize, getPdfJsDocument } from '../utils/pdfUtils';
import type { UploadedFile } from '../types';

interface MergeToolProps {
  onHome: () => void;
}

export const MergeTool: React.FC<MergeToolProps> = ({ onHome }) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultData, setResultData] = useState<Uint8Array | null>(null);

  const handleFilesSelected = async (selectedFiles: File[]) => {
    setErrorMsg(null);

    const items = await Promise.all(
      selectedFiles.map(async (f) => {
        try {
          const buffer = await f.arrayBuffer();
          let pageCount = 1;
          try {
            const doc = await getPdfJsDocument(buffer);
            pageCount = doc.numPages;
          } catch (e) {
            // ignore page count reading failure
          }

          return {
            id: Math.random().toString(36).substring(2, 9),
            file: f,
            name: f.name,
            size: f.size,
            arrayBuffer: buffer,
            pageCount,
          } as UploadedFile;
        } catch (err) {
          console.error('Error reading file:', err);
          return null;
        }
      })
    );

    const validItems = items.filter((item): item is UploadedFile => item !== null);
    setFiles((prev) => [...prev, ...validItems]);
  };

  const handleRemove = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === files.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...files];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);
    setFiles(reordered);
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      setErrorMsg('Selecciona al menos 2 archivos PDF para poder unirlos.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const freshBuffers = await Promise.all(
        files.map(async (f) => ({
          data: await f.file.arrayBuffer(),
          name: f.name,
        }))
      );
      const mergedBytes = await mergePdfs(freshBuffers);
      setResultData(mergedBytes);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Ocurrió un error al unir los archivos PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultData) return;
    const base = files[0]?.name.replace(/\.[^/.]+$/, '') || 'documentos';
    downloadBlob(resultData, `${base}_unido.pdf`);
  };

  const handleReset = () => {
    setFiles([]);
    setResultData(null);
    setErrorMsg(null);
  };

  if (resultData) {
    const totalOriginalSize = files.reduce((acc, f) => acc + f.size, 0);
    const totalPages = files.reduce((acc, f) => acc + (f.pageCount || 0), 0);

    return (
      <SuccessView
        title="¡Tus archivos PDF se han unido!"
        subtitle={`Se han combinado ${files.length} documentos con un total de ${totalPages} páginas.`}
        onDownload={handleDownload}
        onReset={handleReset}
        onHome={onHome}
        downloadLabel="Descargar PDF Unido"
        stats={{
          originalSize: totalOriginalSize,
          newSize: resultData.byteLength,
        }}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Tool Title Banner */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-100 text-brand-600 mb-3 shadow-inner">
          <Combine className="w-7 h-7" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Unir archivos PDF
        </h1>
        <p className="text-slate-500 mt-2 text-base">
          Combina PDFs en el orden que desees de manera rápida y 100% privada.
        </p>
      </div>

      {files.length === 0 ? (
        <Dropzone
          onFilesSelected={handleFilesSelected}
          multiple={true}
          title="Seleccionar archivos PDF"
          subtitle="o arrastra varios PDFs para combinarlos"
        />
      ) : (
        <div className="space-y-6">
          {/* Action bar above files */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-800 text-sm">
                {files.length} {files.length === 1 ? 'archivo añadido' : 'archivos añadidos'}
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-xs text-slate-500">
                Arrastra o usa las flechas para ordenar los documentos
              </span>
            </div>

            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer">
                <Plus className="w-4 h-4 text-slate-600" />
                <span>Añadir más PDFs</span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) handleFilesSelected(Array.from(e.target.files));
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </label>

              <button
                onClick={handleReset}
                className="px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
              >
                Limpiar lista
              </button>
            </div>
          </div>

          {/* Files List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map((item, index) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs hover:border-brand-300 transition-[border-color,box-shadow] flex flex-col justify-between group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-12 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-brand-600 shrink-0 font-bold text-xs">
                    {index + 1}º
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-800 truncate" title={item.name}>
                      {item.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                      <span>{formatFileSize(item.size)}</span>
                      <span>•</span>
                      <span>{item.pageCount || 1} pág.</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemove(item.id)}
                    className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                    title="Eliminar este archivo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Move buttons */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs text-slate-500">
                  <span className="font-medium text-slate-400">Posición en el documento</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveItem(index, 'up')}
                      disabled={index === 0}
                      className="p-1 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Mover arriba"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveItem(index, 'down')}
                      disabled={index === files.length - 1}
                      className="p-1 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Mover abajo"
                    >
                      <ArrowDown className="w-4 h-4" />
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

          {/* Sticky Big Merge Button */}
          <div className="sticky bottom-6 z-20 flex justify-center pt-4">
            <button
              onClick={handleMerge}
              disabled={isProcessing || files.length < 2}
              className="inline-flex items-center gap-3 px-10 py-5 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:bg-slate-300 text-white font-extrabold text-xl rounded-2xl shadow-xl shadow-brand-600/30 hover:shadow-brand-600/40 transition-[background-color,box-shadow,transform] transform hover:-translate-y-0.5 cursor-pointer disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Uniendo archivos PDF...</span>
                </>
              ) : (
                <>
                  <Combine className="w-6 h-6" />
                  <span>Unir PDF ({files.length} archivos)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
