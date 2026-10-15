import React, { useState, useEffect, useRef } from 'react';
import {
  Combine,
  Split,
  Layers,
  PenTool,
  Minimize2,
  FileImage,
  ImagePlus,
  Stamp,
  Lock,
  Search,
  Sparkles,
  ArrowRight,
  Hash,
  ScanText,
  GitCompare,
  Unlock,
  Laptop,
  Download,
  HelpCircle,
  X,
  FileText,
  Crop,
  EyeOff,
  ShieldCheck,
  Zap,
  Cpu,
} from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { TOOLS } from '../data/tools';
import type { ToolId, ToolCategory } from '../types';

interface ToolGridProps {
  onSelectTool: (id: ToolId) => void;
}

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  Combine,
  Split,
  Layers,
  PenTool,
  Minimize2,
  FileImage,
  ImagePlus,
  Stamp,
  Lock,
  Hash,
  ScanText,
  GitCompare,
  Unlock,
  FileText,
  Crop,
  EyeOff,
};

export const ToolGrid: React.FC<ToolGridProps> = ({ onSelectTool }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory | 'all'>('all');
  const [showInstructions, setShowInstructions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { canInstall, isInstalled, promptInstall } = usePwaInstall();

  // Keyboard shortcut Ctrl+K or / to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleInstallClick = () => {
    if (canInstall) {
      promptInstall();
    } else {
      setShowInstructions((prev) => !prev);
    }
  };

  const filteredTools = TOOLS.filter((tool) => {
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.shortDesc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.fullDesc.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      {/* Background Ambient Glow Orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-96 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute top-12 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
      </div>

      {/* Hero Header */}
      <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-20">
        {/* Next-gen Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border border-indigo-200/60 text-indigo-700 text-xs font-extrabold uppercase tracking-wider mb-6 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
          <span>Motor Local WebAssembly • 100% Confidencial</span>
        </div>

        {/* High-impact Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-slate-900 tracking-tight leading-[1.08]">
          Herramientas PDF de nivel{' '}
          <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 bg-clip-text text-transparent">
            profesional
          </span>
        </h1>

        <p className="mt-5 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
          Manipula, transforma y protege tus documentos sin límites. Todo se ejecuta de forma nativa en tu propio navegador con máxima velocidad y privacidad absoluta.
        </p>

        {/* Pro Capability Chips */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-slate-600">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/80 rounded-full border border-slate-200/80 shadow-2xs">
            <Cpu className="w-3.5 h-3.5 text-indigo-600" />
            16 Herramientas Integradas
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/80 rounded-full border border-slate-200/80 shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Cero Subidas a Servidores
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/80 rounded-full border border-slate-200/80 shadow-2xs">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Sin Registro ni Límites
          </span>
        </div>

        {/* Floating Command Search Bar */}
        <div className="mt-9 max-w-xl mx-auto relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-cyan-500/20 rounded-3xl blur-lg opacity-0 group-focus-within:opacity-100 transition duration-300" />
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 sm:pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
              <Search className="w-5 h-5" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              aria-label="Buscar herramienta"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o acción (ej: unir, anonimizar, firmar, OCR...)"
              className="w-full pl-12 pr-20 py-4 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl text-sm font-medium shadow-md shadow-slate-900/5 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:outline-none transition-all placeholder:text-slate-400"
            />
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center gap-1 pointer-events-none">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="pointer-events-auto p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <kbd className="hidden sm:inline-block px-2 py-1 bg-slate-100 border border-slate-200 text-slate-500 rounded-lg text-[10px] font-bold font-mono">
                  ⌘K
                </kbd>
              )}
            </div>
          </div>
        </div>

        {/* Segmented Category Filter Capsules */}
        <div className="mt-7 inline-flex flex-wrap items-center justify-center gap-1.5 p-1.5 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xs">
          {[
            { id: 'all', label: 'Todas las herramientas' },
            { id: 'organize', label: 'Organizar' },
            { id: 'optimize', label: 'Optimizar' },
            { id: 'edit', label: 'Editar' },
            { id: 'convert', label: 'Convertir' },
            { id: 'security', label: 'Seguridad & RGPD' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/15'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* PWA Windows Native App Banner */}
      {!isInstalled && (
        <div className="mb-12 max-w-4xl mx-auto bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-7 text-white shadow-xl border border-indigo-500/20 relative overflow-hidden group">
          <div className="absolute -right-16 -bottom-16 w-60 h-60 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-5 relative z-10">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
                <Laptop className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h4 className="font-extrabold text-base tracking-tight text-white">
                    Instalar como App Nativa en Windows
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
                    Offline
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-lg">
                  Lanza tus herramientas instantáneamente desde tu barra de tareas o menú de inicio, con funcionamiento 100% offline sin necesidad de conexión.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleInstallClick}
              aria-label="Instalar PDFStudio Pro en Windows"
              className="shrink-0 inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:from-indigo-700 active:to-violet-700 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-indigo-600/30 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{canInstall ? 'Instalar en Windows' : 'Cómo Instalar'}</span>
            </button>
          </div>

          {showInstructions && (
            <div className="mt-5 pt-4 border-t border-slate-800 text-xs text-slate-300 space-y-2 relative z-10">
              <div className="flex items-start justify-between">
                <p className="font-semibold text-white flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-indigo-400" />
                  Instrucciones de instalación en Google Chrome o Microsoft Edge:
                </p>
                <button
                  type="button"
                  onClick={() => setShowInstructions(false)}
                  aria-label="Cerrar instrucciones"
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="list-decimal list-inside space-y-1 pl-2 text-slate-300">
                <li>
                  En tu navegador, pulsa en el icono de instalación (<strong>🖥️ Instalar</strong> o <strong>➕</strong>) situado a la derecha de la barra de direcciones.
                </li>
                <li>
                  Haz clic en <strong>"Instalar"</strong> en el cuadro de diálogo.
                </li>
                <li>
                  ¡Listo! La aplicación se abrirá como ventana nativa independiente y podrás anclarla a Windows.
                </li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Grid of Tools (Bento Pro Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTools.map((tool) => {
          const IconComponent = iconMap[tool.icon] || Combine;

          return (
            <button
              type="button"
              key={tool.id}
              onClick={() => onSelectTool(tool.id)}
              className="text-left w-full group bg-white/95 backdrop-blur-sm rounded-3xl p-6 sm:p-7 border border-slate-200/80 hover:border-indigo-500/40 shadow-xs hover:shadow-card-hover transition-all duration-300 cursor-pointer flex flex-col justify-between transform hover:-translate-y-1.5 relative overflow-hidden"
            >
              {/* Subtle top accent ambient glow */}
              <div
                className="absolute top-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ backgroundColor: tool.color }}
              />

              <div>
                <div className="flex items-start justify-between mb-5">
                  {/* Glowing 3D-effect Icon Container */}
                  <div
                    className="w-13 h-13 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-sm ring-1 ring-black/5"
                    style={{
                      backgroundColor: `${tool.color}14`,
                      color: tool.color,
                      boxShadow: `0 8px 20px -6px ${tool.color}35`,
                    }}
                  >
                    <IconComponent className="w-6 h-6" />
                  </div>

                  {tool.badge && (
                    <span
                      className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded-lg ring-1 shadow-2xs"
                      style={{
                        backgroundColor: `${tool.color}12`,
                        color: tool.color,
                        borderColor: `${tool.color}30`,
                      }}
                    >
                      {tool.badge}
                    </span>
                  )}
                </div>

                <h3 className="font-extrabold text-xl text-slate-900 group-hover:text-indigo-600 transition-colors tracking-tight font-sans">
                  {tool.name}
                </h3>

                <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
                  {tool.shortDesc}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">
                <span>Abrir herramienta</span>
                <div className="w-7 h-7 rounded-xl bg-slate-50 group-hover:bg-indigo-50 flex items-center justify-center transition-colors">
                  <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {filteredTools.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            No se encontraron herramientas
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            No encontramos ninguna herramienta que coincida con "{searchQuery}". Intenta con otros términos como unir, comprimir o firmar.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            className="mt-4 px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl cursor-pointer transition-colors"
          >
            Restablecer búsqueda
          </button>
        </div>
      )}
    </div>
  );
};
