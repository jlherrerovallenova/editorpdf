import React from 'react';
import { Shield, Zap, Lock, Heart } from 'lucide-react';
import type { ToolId } from '../types';

interface FooterProps {
  onSelectTool: (toolId: ToolId) => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectTool }) => {
  return (
    <footer className="bg-slate-950 text-slate-300 mt-20 border-t border-slate-800/80">
      {/* Privacy Banner */}
      <div className="border-b border-slate-800/80 bg-slate-900/60 py-8">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-6 text-center md:text-left">
          <div className="flex items-center gap-4 justify-center md:justify-start">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 shadow-sm">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">Privacidad Total Garantizada</h4>
              <p className="text-xs text-slate-400 mt-0.5">Tus documentos nunca salen de tu equipo. Procesamiento seguro en memoria local.</p>
            </div>
          </div>

          <div className="flex items-center gap-4 justify-center md:justify-start">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-sm">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">Velocidad Instantánea</h4>
              <p className="text-xs text-slate-400 mt-0.5">Cero colas de espera. Motor local acelerado por WebAssembly y HTML5 Canvas.</p>
            </div>
          </div>

          <div className="flex items-center gap-4 justify-center md:justify-start">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-sm">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">100% Ilimitado y Conforme RGPD</h4>
              <p className="text-xs text-slate-400 mt-0.5">Sin marcas de agua forzadas, sin suscripciones y sin necesidad de registro.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-4">
              Organizar PDF
            </h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>
                <button onClick={() => onSelectTool('merge')} className="hover:text-indigo-400 transition-colors cursor-pointer">
                  Unir PDF
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTool('split')} className="hover:text-indigo-400 transition-colors cursor-pointer">
                  Dividir PDF
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTool('organize')} className="hover:text-indigo-400 transition-colors cursor-pointer">
                  Organizar y Rotar páginas
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTool('compare')} className="hover:text-indigo-400 transition-colors cursor-pointer">
                  Comparar PDFs
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
                <button onClick={() => onSelectTool('compress')} className="hover:text-indigo-400 transition-colors cursor-pointer">
                  Comprimir PDF
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTool('edit')} className="hover:text-indigo-400 transition-colors cursor-pointer">
                  Editar PDF & Firmas
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTool('crop')} className="hover:text-indigo-400 transition-colors cursor-pointer">
                  Recortar PDF
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTool('watermark')} className="hover:text-indigo-400 transition-colors cursor-pointer">
                  Añadir Marca de Agua
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTool('page-number')} className="hover:text-indigo-400 transition-colors cursor-pointer">
                  Numerar Páginas
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
                <button onClick={() => onSelectTool('pdf-to-word')} className="hover:text-indigo-400 transition-colors cursor-pointer">
                  PDF a Word (.docx)
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTool('ocr')} className="hover:text-indigo-400 transition-colors cursor-pointer">
                  OCR Reconocer Texto
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTool('img-to-pdf')} className="hover:text-indigo-400 transition-colors cursor-pointer">
                  JPG / Imagen a PDF
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTool('pdf-to-img')} className="hover:text-indigo-400 transition-colors cursor-pointer">
                  PDF a JPG
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTool('protect')} className="hover:text-indigo-400 transition-colors cursor-pointer">
                  Proteger con Contraseña
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTool('unlock')} className="hover:text-indigo-400 transition-colors cursor-pointer">
                  Desbloquear PDF
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTool('anonymize')} className="hover:text-teal-300 transition-colors cursor-pointer flex items-center gap-1.5 text-teal-300">
                  <span>Anonimizar PDF</span>
                  <span className="text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded font-bold border border-teal-500/30">RGPD</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© 2026 PDFStudio Pro • Suite Profesional de Herramientas PDF.</p>
          <p className="flex items-center gap-1">
            Hecho con <Heart className="w-3.5 h-3.5 text-indigo-400 fill-indigo-400 inline" /> para máxima productividad
          </p>
        </div>
      </div>
    </footer>
  );
};
