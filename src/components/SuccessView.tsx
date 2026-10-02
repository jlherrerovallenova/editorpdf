import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Download, CheckCircle2, RotateCcw, Home, Sparkles } from 'lucide-react';
import { formatFileSize } from '../utils/pdfUtils';

interface SuccessViewProps {
  title: string;
  subtitle?: string;
  onDownload: () => void;
  onReset: () => void;
  onHome: () => void;
  downloadLabel?: string;
  stats?: {
    originalSize?: number;
    newSize?: number;
    savedPercentage?: number;
    fileCount?: number;
    pageCount?: number;
  };
}

export const SuccessView: React.FC<SuccessViewProps> = ({
  title,
  subtitle,
  onDownload,
  onReset,
  onHome,
  downloadLabel = 'Descargar PDF',
  stats,
}) => {
  useEffect(() => {
    // Fire confetti celebration
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'],
      });
    } catch (e) {
      // ignore in environments without canvas
    }
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto my-12 bg-white rounded-3xl p-8 sm:p-12 shadow-xl border border-slate-100 text-center animate-fade-in">
      <div className="w-20 h-20 rounded-full bg-emerald-100 border-4 border-emerald-50 mx-auto flex items-center justify-center text-emerald-600 mb-6 shadow-inner">
        <CheckCircle2 className="w-10 h-10" />
      </div>

      <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
        {title}
      </h2>
      <p className="text-slate-500 mt-2 text-sm sm:text-base max-w-lg mx-auto">
        {subtitle || 'Tu archivo está listo para ser descargado a tu equipo.'}
      </p>

      {/* Stats block if compression or processing info provided */}
      {stats && (stats.originalSize !== undefined || stats.savedPercentage !== undefined) && (
        <div className="my-8 p-6 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-around gap-4 text-center">
          {stats.originalSize !== undefined && (
            <div>
              <span className="block text-xs uppercase tracking-wider font-semibold text-slate-400">
                Tamaño Original
              </span>
              <span className="text-base font-bold text-slate-700">
                {formatFileSize(stats.originalSize)}
              </span>
            </div>
          )}

          {stats.newSize !== undefined && (
            <div>
              <span className="block text-xs uppercase tracking-wider font-semibold text-slate-400">
                Nuevo Tamaño
              </span>
              <span className="text-base font-bold text-emerald-600">
                {formatFileSize(stats.newSize)}
              </span>
            </div>
          )}

          {stats.savedPercentage !== undefined && (
            <div className="px-4 py-2 bg-emerald-100/70 border border-emerald-200 rounded-xl">
              <span className="block text-[11px] uppercase tracking-wider font-bold text-emerald-800">
                Ahorro conseguido
              </span>
              <span className="text-lg font-extrabold text-emerald-700">
                -{stats.savedPercentage}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
        <button
          onClick={onDownload}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold text-lg rounded-2xl shadow-xl shadow-brand-600/30 hover:shadow-brand-600/40 transition-[background-color,box-shadow,transform] transform hover:-translate-y-0.5 cursor-pointer"
        >
          <Download className="w-5 h-5" />
          {downloadLabel}
        </button>

        <button
          onClick={onReset}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-2xl transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Procesar otro archivo
        </button>
      </div>

      <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center">
        <button
          onClick={onHome}
          className="text-xs font-semibold text-slate-400 hover:text-brand-600 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Home className="w-3.5 h-3.5" />
          Ver todas las herramientas PDF
        </button>
      </div>
    </div>
  );
};
