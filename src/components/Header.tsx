import React from 'react';
import {
  FileText,
  ShieldCheck,
  ArrowLeft,
  Sparkles,
  Layers,
  Combine,
  Split,
  PenTool,
  Minimize2,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import type { ToolId } from '../types';

interface HeaderProps {
  currentTool: ToolId | null;
  onSelectTool: (toolId: ToolId | null) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTool, onSelectTool }) => {
  const { canInstall, isInstalled, promptInstall } = usePwaInstall();
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Back button */}
          <div className="flex items-center gap-3">
            {currentTool && (
              <button
                onClick={() => onSelectTool(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Volver al inicio"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Inicio</span>
              </button>
            )}

            <button
              onClick={() => onSelectTool(null)}
              className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-brand-700 flex items-center justify-center text-white shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-xl tracking-tight text-slate-900 group-hover:text-brand-600 transition-colors">
                  PDF<span className="text-brand-600">Master</span>
                </span>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-600">
                  Herramientas PDF en línea
                </span>
              </div>
            </button>
          </div>

          {/* Quick Access Nav links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1">
            <button
              onClick={() => onSelectTool('merge')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                currentTool === 'merge' ? 'bg-brand-50 text-brand-600 font-semibold' : 'text-slate-600 hover:text-brand-600 hover:bg-slate-100'
              }`}
            >
              <Combine className="w-4 h-4 text-brand-500" />
              Unir PDF
            </button>
            <button
              onClick={() => onSelectTool('split')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                currentTool === 'split' ? 'bg-brand-50 text-brand-600 font-semibold' : 'text-slate-600 hover:text-brand-600 hover:bg-slate-100'
              }`}
            >
              <Split className="w-4 h-4 text-rose-500" />
              Dividir
            </button>
            <button
              onClick={() => onSelectTool('compress')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                currentTool === 'compress' ? 'bg-brand-50 text-brand-600 font-semibold' : 'text-slate-600 hover:text-brand-600 hover:bg-slate-100'
              }`}
            >
              <Minimize2 className="w-4 h-4 text-emerald-500" />
              Comprimir
            </button>
            <button
              onClick={() => onSelectTool('edit')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                currentTool === 'edit' ? 'bg-brand-50 text-brand-600 font-semibold' : 'text-slate-600 hover:text-brand-600 hover:bg-slate-100'
              }`}
            >
              <PenTool className="w-4 h-4 text-blue-500" />
              Editar PDF
            </button>
            <button
              onClick={() => onSelectTool('organize')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                currentTool === 'organize' ? 'bg-brand-50 text-brand-600 font-semibold' : 'text-slate-600 hover:text-brand-600 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-4 h-4 text-orange-500" />
              Organizar
            </button>
          </nav>

          {/* PWA Install Button & Privacy badge */}
          <div className="flex items-center gap-2">
            {canInstall && (
              <button
                type="button"
                onClick={promptInstall}
                aria-label="Instalar aplicación en Windows"
                title="Instalar PDFMaster como aplicación en tu equipo"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-600/20 transition-[background-color,box-shadow] cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Instalar App</span>
              </button>
            )}

            {isInstalled && (
              <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>App Instalada</span>
              </div>
            )}

            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>100% Privado en tu Navegador</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
