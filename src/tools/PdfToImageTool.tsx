import React, { useState } from 'react';
import {
  FileImage,
  Download,
  Archive,
  Loader2,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { Dropzone } from '../components/Dropzone';
import { SuccessView } from '../components/SuccessView';
import { pdfToImages, createZip, downloadBlob } from '../utils/pdfUtils';

interface PdfToImageToolProps {
  onHome: () => void;
}

export const PdfToImageTool: React.FC<PdfToImageToolProps> = ({ onHome }) => {
  const [file, setFile] = useState<File | null>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [format, setFormat] = useState<'image/jpeg' | 'image/png'>('image/jpeg');
  const [qualityScale, setQualityScale] = useState<number>(2.0); // 1.5 standard, 2.5 high
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [images, setImages] = useState<{ name: string; blob: Blob; dataUrl: string }[] | null>(null);

  const handleFileSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
    setFile(f);
    setErrorMsg(null);
    try {
      const buffer = await f.arrayBuffer();
      setArrayBuffer(buffer);
    } catch (e) {
      setErrorMsg('No se pudo leer el archivo.');
    }
  };

  const handleConvert = async () => {
    if (!arrayBuffer || !file) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setProgressStatus('Extrayendo páginas a imágenes...');

    try {
      const freshBuffer = await file.arrayBuffer();
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const results = await pdfToImages(
        freshBuffer,
        format,
        qualityScale,
        0.92,
        baseName,
        (curr, tot) => {
          setProgressStatus(`Renderizando página ${curr} de ${tot}...`);
        }
      );
      setImages(results);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Error al convertir el PDF a imágenes.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadAllZip = async () => {
    if (!images || !file) return;
    const zipBlob = await createZip(images.map((img) => ({ name: img.name, blob: img.blob })));
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    downloadBlob(zipBlob, `${baseName}_imagenes.zip`, 'application/zip');
  };

  const handleReset = () => {
    setFile(null);
    setArrayBuffer(null);
    setImages(null);
    setErrorMsg(null);
  };

  if (images) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in">
        <SuccessView
          title="¡Tu PDF se ha convertido a imágenes!"
          subtitle={`Se han generado ${images.length} imágenes de alta resolución listas para descargar.`}
          onDownload={handleDownloadAllZip}
          onReset={handleReset}
          onHome={onHome}
          downloadLabel="Descargar Todas las Imágenes (.ZIP)"
        />

        {/* Gallery preview of all extracted images */}
        <div className="mt-12 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs">
          <h3 className="font-bold text-slate-800 text-lg mb-6">
            Vistas previas individuales:
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {images.map((img, idx) => (
              <div
                key={idx}
                className="bg-slate-50 rounded-2xl p-3 border border-slate-200 flex flex-col justify-between group"
              >
                <div className="relative aspect-3/4 rounded-xl overflow-hidden bg-white border border-slate-100 flex items-center justify-center p-1">
                  <img src={img.dataUrl} alt={img.name} className="max-w-full max-h-full object-contain" />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 truncate max-w-[120px]">
                    {img.name}
                  </span>
                  <button
                    onClick={() => downloadBlob(img.blob, img.name, format)}
                    className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
                    title="Descargar esta imagen"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Title */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 mb-3 shadow-inner">
          <FileImage className="w-7 h-7" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          PDF a JPG o PNG
        </h1>
        <p className="text-slate-500 mt-2 text-base">
          Extrae todas las páginas de tu PDF como imágenes nítidas para compartir o imprimir.
        </p>
      </div>

      {!file ? (
        <Dropzone
          onFilesSelected={handleFileSelected}
          multiple={false}
          title="Seleccionar archivo PDF"
          subtitle="o arrastra un PDF aquí para extraer sus imágenes"
        />
      ) : (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <FileCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate max-w-sm">
                  {file.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Archivo cargado correctamente</p>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
            >
              Cambiar archivo
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                  JPG (Más ligero)
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

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Resolución y Nitidez
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setQualityScale(1.5)}
                  className={`py-3 px-3 text-xs font-bold rounded-2xl border transition-all cursor-pointer ${
                    qualityScale === 1.5
                      ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  Estándar (150 DPI)
                </button>
                <button
                  type="button"
                  onClick={() => setQualityScale(2.5)}
                  className={`py-3 px-3 text-xs font-bold rounded-2xl border transition-all cursor-pointer ${
                    qualityScale === 2.5
                      ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  Alta Definición (300 DPI)
                </button>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 border border-red-200 rounded-2xl text-sm font-semibold">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="pt-4 flex justify-center">
            <button
              onClick={handleConvert}
              disabled={isProcessing}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-10 py-5 bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-xl rounded-2xl shadow-xl shadow-brand-600/30 transition-all cursor-pointer disabled:bg-slate-300"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>{progressStatus || 'Convirtiendo...'}</span>
                </>
              ) : (
                <>
                  <FileImage className="w-6 h-6" />
                  <span>Convertir PDF a {format === 'image/jpeg' ? 'JPG' : 'PNG'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
