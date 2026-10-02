import React, { useState } from 'react';
import {
  ImagePlus,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Loader2,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { Dropzone } from '../components/Dropzone';
import { SuccessView } from '../components/SuccessView';
import { imagesToPdf, downloadBlob, formatFileSize } from '../utils/pdfUtils';

interface ImageItem {
  id: string;
  file: File;
  dataUrl: string;
  width: number;
  height: number;
  type: string;
}

interface ImageToPdfToolProps {
  onHome: () => void;
}

export const ImageToPdfTool: React.FC<ImageToPdfToolProps> = ({ onHome }) => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape' | 'fit'>('portrait');
  const [pageSize, setPageSize] = useState<'a4' | 'fit'>('a4');
  const [margin, setMargin] = useState<number>(15);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultData, setResultData] = useState<Uint8Array | null>(null);

  const handleFilesSelected = (selectedFiles: File[]) => {
    setErrorMsg(null);

    selectedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          setImages((prev) => [
            ...prev,
            {
              id: Math.random().toString(36).substring(2, 9),
              file,
              dataUrl,
              width: img.width,
              height: img.height,
              type: file.type,
            },
          ]);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === images.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...images];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);
    setImages(reordered);
  };

  const handleConvert = async () => {
    if (images.length === 0) {
      setErrorMsg('Selecciona al menos una imagen.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const pdfBytes = await imagesToPdf(images, {
        orientation,
        pageSize,
        margin,
      });
      setResultData(pdfBytes);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Error al convertir las imágenes a PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultData) return;
    const baseName = images[0]?.file.name.replace(/\.[^/.]+$/, '') || 'imagenes';
    downloadBlob(resultData, `${baseName}.pdf`);
  };

  const handleReset = () => {
    setImages([]);
    setResultData(null);
    setErrorMsg(null);
  };

  if (resultData) {
    return (
      <SuccessView
        title="¡Tus imágenes han sido convertidas a PDF!"
        subtitle={`Se ha generado un nuevo archivo PDF con ${images.length} páginas.`}
        onDownload={handleDownload}
        onReset={handleReset}
        onHome={onHome}
        downloadLabel="Descargar PDF Creado"
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Title */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-pink-100 text-pink-600 mb-3 shadow-inner">
          <ImagePlus className="w-7 h-7" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          JPG a PDF
        </h1>
        <p className="text-slate-500 mt-2 text-base">
          Convierte imágenes JPG, PNG o WebP a formato PDF con orientación y márgenes a tu gusto.
        </p>
      </div>

      {images.length === 0 ? (
        <Dropzone
          onFilesSelected={handleFilesSelected}
          accept="image/jpeg,image/png,image/webp"
          multiple={true}
          title="Seleccionar imágenes JPG o PNG"
          buttonLabel="Seleccionar imágenes"
          subtitle="o arrastra las fotos que deseas transformar en PDF"
        />
      ) : (
        <div className="space-y-6">
          {/* Options Box */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Orientación
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'portrait', label: 'Vertical' },
                  { id: 'landscape', label: 'Horizontal' },
                  { id: 'fit', label: 'Auto' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setOrientation(opt.id as any)}
                    className={`py-2 px-1 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                      orientation === opt.id
                        ? 'border-pink-500 bg-pink-50 text-pink-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Tamaño de página
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPageSize('a4')}
                  className={`py-2 px-1 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                    pageSize === 'a4'
                      ? 'border-pink-500 bg-pink-50 text-pink-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  A4 estándar
                </button>
                <button
                  type="button"
                  onClick={() => setPageSize('fit')}
                  className={`py-2 px-1 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                    pageSize === 'fit'
                      ? 'border-pink-500 bg-pink-50 text-pink-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  Ajustar a imagen
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Margen de página
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: 0, label: 'Sin margen' },
                  { val: 15, label: 'Pequeño' },
                  { val: 35, label: 'Grande' },
                ].map((m) => (
                  <button
                    key={m.val}
                    type="button"
                    onClick={() => setMargin(m.val)}
                    className={`py-2 px-1 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                      margin === m.val
                        ? 'border-pink-500 bg-pink-50 text-pink-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
            <span className="text-xs font-bold text-slate-700">
              {images.length} imágenes listas para convertir
            </span>

            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer">
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir más fotos</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => {
                  if (e.target.files) handleFilesSelected(Array.from(e.target.files));
                  e.target.value = '';
                }}
                className="hidden"
              />
            </label>
          </div>

          {/* Images Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {images.map((img, index) => (
              <div
                key={img.id}
                className="bg-white rounded-2xl p-2.5 border border-slate-200 shadow-xs flex flex-col justify-between group hover:border-pink-400"
              >
                <div className="relative aspect-3/4 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
                  <img
                    src={img.dataUrl}
                    alt={img.file.name}
                    className="max-w-full max-h-full object-contain"
                  />
                  <div className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-slate-900/70 text-white text-[10px] font-bold rounded-md">
                    {index + 1}
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveItem(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveItem(index, 'down')}
                      disabled={index === images.length - 1}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeImage(img.id)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded-md cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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
          <div className="sticky bottom-6 z-20 flex justify-center">
            <button
              onClick={handleConvert}
              disabled={isProcessing || images.length === 0}
              className="inline-flex items-center gap-3 px-10 py-5 bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-xl rounded-2xl shadow-xl shadow-brand-600/30 transition-[background-color,box-shadow] cursor-pointer disabled:bg-slate-300"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Convirtiendo a PDF...</span>
                </>
              ) : (
                <>
                  <ImagePlus className="w-6 h-6" />
                  <span>Convertir a PDF ({images.length} imágenes)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
