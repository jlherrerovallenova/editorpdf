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
  EyeOff,
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
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo & Back button */}
          <div className="flex items-center gap-3">
            {currentTool && (
              <button
                onClick={() => onSelectTool(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer shadow-xs"
                title="Volver a todas las herramientas"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Inicio</span>
              </button>
            )}

            <button
              onClick={() => onSelectTool(null)}
              className="flex items-center gap-3 text-left group cursor-pointer focus:outline-none"
            >
              <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/25 group-hover:shadow-indigo-600/40 group-hover:scale-105 transition-all ring-1 ring-white/20">
                <Sparkles className="w-5 h-5 text-indigo-100" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-xl tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
                    PDF<span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Studio</span>
                  </span>
                  <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-xs">
                    PRO
                  </span>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                  Suite Local de Documentos
                </span>
              </div>
            </button>
          </div>

          {/* Quick Access Nav links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-100/70 p-1 rounded-2xl border border-slate-200/60 backdrop-blur-md">
            {[
              { id: 'merge', label: 'Unir', icon: Combine, color: 'text-indigo-600' },
              { id: 'split', label: 'Dividir', icon: Split, color: 'text-rose-600' },
              { id: 'compress', label: 'Comprimir', icon: Minimize2, color: 'text-emerald-600' },
              { id: 'edit', label: 'Editar', icon: PenTool, color: 'text-blue-600' },
              { id: 'organize', label: 'Organizar', icon: Layers, color: 'text-amber-600' },
              { id: 'anonymize', label: 'Anonimizar', icon: EyeOff, color: 'text-teal-600' },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = currentTool === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTool(item.id as ToolId)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${item.color}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Status & Actions */}
          <div className="flex items-center gap-2.5">
            {/* Live Privacy Beacon */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50/80 text-emerald-800 border border-emerald-200/70 rounded-full text-xs font-semibold shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="hidden md:inline">100% Local • Cero Nube</span>
              <span className="md:hidden">Local</span>
            </div>

            {canInstall && (
              <button
                type="button"
                onClick={promptInstall}
                aria-label="Instalar aplicación en Windows"
                title="Instalar PDFStudio Pro como aplicación nativa en Windows"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/25 transition-all transform hover:-translate-y-0.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Instalar App</span>
              </button>
            )}

            {isInstalled && (
              <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nativa</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
