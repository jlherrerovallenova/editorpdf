import React from 'react';
import { Shield, Zap, Lock, Heart } from 'lucide-react';
import type { ToolId } from '../types';

interface FooterProps {
  onSelectTool: (toolId: ToolId) => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectTool }) => {
  return (
    <footer className="bg-slate-900 text-slate-300 mt-20 border-t border-slate-800">
      {/* Privacy Banner */}
      <div className="border-b border-slate-800/80 bg-slate-950/60 py-8">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-6 text-center md:text-left">
          <div className="flex items-center gap-4 justify-center md:justify-start">
            <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400 shrink-0">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm">Privacidad Total Garantizada</h4>
              <p className="text-xs text-slate-300 mt-0.5">Tus documentos nunca se envían a ningún servidor externo. Todo se procesa en la memoria de tu dispositivo.</p>
            </div>
          </div>

          <div className="flex items-center gap-4 justify-center md:justify-start">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm">Velocidad Instantánea</h4>
              <p className="text-xs text-slate-300 mt-0.5">Sin colas de espera ni tiempos de subida de archivos pesados. Procesamiento con WebAssembly y Canvas.</p>
            </div>
          </div>

          <div className="flex items-center gap-4 justify-center md:justify-start">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm">100% Gratis e Ilimitado</h4>
              <p className="text-xs text-slate-300 mt-0.5">Sin límites de páginas, sin marcas de agua forzadas y sin necesidad de crear cuenta.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-4">
              Organizar PDF
            </h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>
                <button onClick={() => onSelectTool('merge')} className="hover:text-brand-400 transition-colors cursor-pointer">
                  Unir PDF
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTool('split')} className="hover:text-brand-400 transition-colors cursor-pointer">
                  Dividir PDF
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTool('organize')} className="hover:text-brand-400 transition-colors cursor-pointer">
                  Organizar y Rotar páginas
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-4">
              Optimizar & Editar
            </h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>
                <button onClick={() => onSelectTool('compress')} className="hover:text-brand-400 transition-colors cursor-pointer">
                  Comprimir PDF
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTool('edit')} className="hover:text-brand-400 transition-colors cursor-pointer">
                  Editar PDF & Firmas
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTool('watermark')} className="hover:text-brand-400 transition-colors cursor-pointer">
                  Añadir Marca de Agua
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-4">
              Convertir & Seguridad
            </h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>
                <button onClick={() => onSelectTool('img-to-pdf')} className="hover:text-brand-400 transition-colors cursor-pointer">
                  JPG / Imagen a PDF
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTool('pdf-to-img')} className="hover:text-brand-400 transition-colors cursor-pointer">
                  PDF a JPG
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTool('protect')} className="hover:text-brand-400 transition-colors cursor-pointer">
                  Proteger con Contraseña
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-4">
              Sobre PDFMaster
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Inspirado en la facilidad y practicidad de iLovePDF. Diseñado con tecnologías web modernas para ejecutarse con privacidad absoluta en tu máquina.
            </p>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-300">
          <p>© 2026 PDFMaster - Suite de herramientas PDF estilo iLovePDF.</p>
          <p className="flex items-center gap-1">
            Hecho con <Heart className="w-3.5 h-3.5 text-brand-500 fill-brand-500 inline" /> para trabajar con PDFs sin complicaciones
          </p>
        </div>
      </div>
    </footer>
  );
};
