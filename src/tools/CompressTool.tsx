import React, { useState } from 'react';
import {
  Minimize2,
  Zap,
  ShieldCheck,
  Sparkles,
  Loader2,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { Dropzone } from '../components/Dropzone';
import { SuccessView } from '../components/SuccessView';
import { compressPdf, downloadBlob, formatFileSize } from '../utils/pdfUtils';

interface CompressToolProps {
  onHome: () => void;
}

export const CompressTool: React.FC<CompressToolProps> = ({ onHome }) => {
  const [file, setFile] = useState<File | null>(null);
  const [compressionLevel, setCompressionLevel] = useState<'extreme' | 'recommended' | 'low'>('recommended');
  const [isCompressing, setIsCompressing] = useState(false);
  const [progressText, setProgressText] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{
    data: Uint8Array;
    originalSize: number;
    newSize: number;
    savedPercentage: number;
  } | null>(null);

  const handleFileSelected = (files: File[]) => {
    if (files.length === 0) return;
    setFile(files[0]);
    setErrorMsg(null);
  };

  const handleCompress = async () => {
    if (!file) return;

    setIsCompressing(true);
    setErrorMsg(null);
    setProgressText('Analizando y optimizando páginas...');

    try {
      const freshBuffer = await file.arrayBuffer();
      const compressResult = await compressPdf(
        freshBuffer,
        compressionLevel,
        (current, total) => {
          setProgressText(`Optimizando página ${current} de ${total}...`);
        }
      );
      setResult(compressResult);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Error al optimizar y comprimir el archivo PDF.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleDownload = () => {
    if (!result || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    downloadBlob(result.data, `${baseName}_comprimido.pdf`);
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setErrorMsg(null);
  };

  if (result) {
    return (
      <SuccessView
        title="¡Tu PDF ha sido comprimido!"
        subtitle={`Tu documento ahora pesa un ${result.savedPercentage}% menos, manteniendo excelente legibilidad.`}
        onDownload={handleDownload}
        onReset={handleReset}
        onHome={onHome}
        downloadLabel="Descargar PDF Comprimido"
        stats={{
          originalSize: result.originalSize,
          newSize: result.newSize,
          savedPercentage: result.savedPercentage,
        }}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Tool Header */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 mb-3 shadow-inner">
          <Minimize2 className="w-7 h-7" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Comprimir archivo PDF
        </h1>
        <p className="text-slate-500 mt-2 text-base">
          Consigue la mejor calidad de PDF reduciendo al máximo el tamaño en kilobytes y megabytes.
        </p>
      </div>

      {!file ? (
        <Dropzone
          onFilesSelected={handleFileSelected}
          multiple={false}
          title="Seleccionar archivo PDF"
          subtitle="o arrastra un PDF aquí para reducir su peso"
        />
      ) : (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <FileCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate max-w-sm">
                  {file.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tamaño original actual: {formatFileSize(file.size)}
                </p>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
            >
              Cambiar archivo
            </button>
          </div>

          <div>
            <h4 className="font-bold text-slate-800 text-sm mb-4">
              Nivel de compresión deseado:
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Extreme */}
              <div
                onClick={() => setCompressionLevel('extreme')}
                className={`p-5 rounded-2xl border-2 transition-[border-color,background-color,box-shadow] cursor-pointer flex flex-col justify-between ${
                  compressionLevel === 'extreme'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 text-sm">Compresión Extrema</span>
                    <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 bg-red-100 text-red-700 rounded-md">
                      Máximo Ahorro
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Menor calidad visual, ideal cuando necesitas enviar un PDF con límite estricto de tamaño.
                  </p>
                </div>
              </div>

              {/* Recommended */}
              <div
                onClick={() => setCompressionLevel('recommended')}
                className={`p-5 rounded-2xl border-2 transition-[border-color,background-color,box-shadow] cursor-pointer flex flex-col justify-between relative ${
                  compressionLevel === 'recommended'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 text-sm">Recomendada</span>
                    <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> Recomendada
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Equilibrio perfecto entre gran reducción de peso y excelente nitidez de texto e imágenes.
                  </p>
                </div>
              </div>

              {/* Low */}
              <div
                onClick={() => setCompressionLevel('low')}
                className={`p-5 rounded-2xl border-2 transition-[border-color,background-color,box-shadow] cursor-pointer flex flex-col justify-between ${
                  compressionLevel === 'low'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 text-sm">Baja Compresión</span>
                    <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">
                      Alta Calidad
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Ligera reducción de tamaño manteniendo la máxima definición original en gráficos e ilustraciones.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 border border-red-200 rounded-2xl text-sm font-semibold">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Compresión procesada 100% en tu navegador</span>
            </div>

            <button
              onClick={handleCompress}
              disabled={isCompressing}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-10 py-4 bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-lg rounded-2xl shadow-xl shadow-brand-600/30 transition-[background-color,box-shadow] cursor-pointer disabled:bg-slate-300"
            >
              {isCompressing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{progressText || 'Comprimiendo PDF...'}</span>
                </>
              ) : (
                <>
                  <Minimize2 className="w-5 h-5" />
                  <span>Comprimir PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
