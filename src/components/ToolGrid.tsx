import React, { useState } from 'react';
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
} from 'lucide-react';
import { TOOLS } from '../data/tools';
import type { ToolDef, ToolId, ToolCategory } from '../types';

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
};

export const ToolGrid: React.FC<ToolGridProps> = ({ onSelectTool }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory | 'all'>('all');

  const filteredTools = TOOLS.filter((tool) => {
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.shortDesc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.fullDesc.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Hero Header */}
      <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 border border-brand-200/80 text-brand-700 text-xs font-bold uppercase tracking-wider mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Editor y Suite PDF 100% Gratuito</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.1]">
          Cada herramienta que necesitas para tus <span className="text-brand-600">PDFs</span>
        </h1>

        <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
          Une, divide, organiza, edita, comprime y protege tus documentos PDF directamente desde tu navegador con privacidad total.
        </p>

        {/* Search Bar */}
        <div className="mt-8 max-w-md mx-auto relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            aria-label="Buscar herramienta"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar herramienta (ej: unir, comprimir, firmar...)"
            className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-medium shadow-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden transition-colors"
          />
        </div>

        {/* Category Pills */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {[
            { id: 'all', label: 'Todas las herramientas' },
            { id: 'organize', label: 'Organizar' },
            { id: 'optimize', label: 'Optimizar' },
            { id: 'edit', label: 'Editar' },
            { id: 'convert', label: 'Convertir' },
            { id: 'security', label: 'Seguridad' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Tools */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTools.map((tool) => {
          const IconComponent = iconMap[tool.icon] || Combine;
          return (
            <button
              type="button"
              key={tool.id}
              onClick={() => onSelectTool(tool.id)}
              className="text-left w-full group bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 hover:border-brand-500/50 shadow-xs hover:shadow-xl hover:shadow-brand-500/5 transition-[border-color,box-shadow,transform] duration-200 cursor-pointer flex flex-col justify-between transform hover:-translate-y-1 relative overflow-hidden"
            >
              {/* Subtle top accent gradient */}
              <div
                className="absolute top-0 left-0 right-0 h-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: tool.color }}
              />

              <div>
                <div className="flex items-start justify-between mb-5">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-xs"
                    style={{ backgroundColor: `${tool.color}15`, color: tool.color }}
                  >
                    <IconComponent className="w-7 h-7" />
                  </div>

                  {tool.badge && (
                    <span
                      className="px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider rounded-lg shadow-2xs"
                      style={{
                        backgroundColor: `${tool.color}15`,
                        color: tool.color,
                      }}
                    >
                      {tool.badge}
                    </span>
                  )}
                </div>

                <h3 className="font-extrabold text-xl text-slate-900 group-hover:text-brand-600 transition-colors tracking-tight">
                  {tool.name}
                </h3>

                <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                  {tool.shortDesc}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-400 group-hover:text-brand-600 transition-colors">
                <span>Abrir herramienta</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          );
        })}
      </div>

      {filteredTools.length === 0 && (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200">
          <p className="text-base font-semibold text-slate-700">
            No encontramos ninguna herramienta que coincida con tu búsqueda.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            className="mt-3 px-4 py-2 text-xs font-bold text-brand-600 bg-brand-50 rounded-xl hover:bg-brand-100 cursor-pointer"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
};
