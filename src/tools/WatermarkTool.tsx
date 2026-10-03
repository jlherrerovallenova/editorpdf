import React, { useState, useEffect, useRef } from 'react';
import {
  Stamp,
  Loader2,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { Dropzone } from '../components/Dropzone';
import { SuccessView } from '../components/SuccessView';
import {
  getPdfJsDocument,
  addWatermarkToPdf,
  downloadBlob,
} from '../utils/pdfUtils';

interface WatermarkToolProps {
  onHome: () => void;
}

export const WatermarkTool: React.FC<WatermarkToolProps> = ({ onHome }) => {
  const [file, setFile] = useState<File | null>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [text, setText] = useState<string>('CONFIDENCIAL');
  const [fontSize, setFontSize] = useState<number>(48);
  const [opacity, setOpacity] = useState<number>(0.3);
  const [rotation, setRotation] = useState<number>(45);
  const [colorHex, setColorHex] = useState<string>('#e5322d');
  const [position, setPosition] = useState<'center' | 'diagonal' | 'repeat'>('diagonal');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultData, setResultData] = useState<Uint8Array | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleFileSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
    setFile(f);
    setErrorMsg(null);
    try {
      const buffer = await f.arrayBuffer();
      setArrayBuffer(buffer);
    } catch {
      setErrorMsg('No se pudo abrir el archivo PDF.');
    }
  };

  // Live preview rendering on page 1 canvas
  useEffect(() => {
    if (!arrayBuffer || !previewCanvasRef.current) return;

    let isCancelled = false;
    const renderPreview = async () => {
      try {
        const doc = await getPdfJsDocument(arrayBuffer);
        const page = await doc.getPage(1);
        const canvas = previewCanvasRef.current;
        if (!canvas || isCancelled) return;

        const viewport = page.getViewport({ scale: 1.0 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvasContext: ctx,
          viewport: viewport,
        }).promise;
      } catch (err) {
        console.error(err);
      }
    };

    renderPreview();
    return () => {
      isCancelled = true;
    };
  }, [arrayBuffer]);

  const handleApply = async () => {
    if (!arrayBuffer || !file) return;
    if (!text.trim()) {
      setErrorMsg('Por favor escribe un texto para la marca de agua.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const freshBuffer = await file.arrayBuffer();
      const output = await addWatermarkToPdf(freshBuffer, {
        text,
        fontSize,
        opacity,
        rotation,
        colorHex,
        position,
      });
      setResultData(output);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Error al aplicar la marca de agua.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultData || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    downloadBlob(resultData, `${baseName}_marca_de_agua.pdf`);
  };

  const handleReset = () => {
    setFile(null);
    setArrayBuffer(null);
    setResultData(null);
    setErrorMsg(null);
  };

  if (resultData) {
    return (
      <SuccessView
        title="¡Marca de agua aplicada!"
        subtitle="Tu documento ahora cuenta con la marca de agua protegida en todas sus páginas."
        onDownload={handleDownload}
        onReset={handleReset}
        onHome={onHome}
        downloadLabel="Descargar PDF con Marca de Agua"
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Title */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-100 text-purple-600 mb-3 shadow-inner">
          <Stamp className="w-7 h-7" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Añadir Marca de Agua al PDF
        </h1>
        <p className="text-slate-500 mt-2 text-base">
          Inserta sellos de confidencialidad, nombres o derechos de autor con vista previa en tiempo real.
        </p>
      </div>

      {!file ? (
        <Dropzone
          onFilesSelected={handleFileSelected}
          multiple={false}
          title="Seleccionar archivo PDF"
          subtitle="o arrastra un PDF aquí para añadirle marca de agua"
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Controls column */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <span className="font-bold text-slate-800 text-sm truncate max-w-[200px]">{file.name}</span>
              <button
                onClick={handleReset}
                className="text-xs font-semibold text-slate-500 hover:text-red-600 cursor-pointer"
              >
                Cambiar archivo
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Texto de la marca de agua
              </label>
              <input
                type="text"
                aria-label="Texto de la marca de agua"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="ej: CONFIDENCIAL"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {['CONFIDENCIAL', 'BORRADOR', 'COPIA', 'ORIGINAL', 'NO COPIAR'].map((badge) => (
                  <button
                    key={badge}
                    type="button"
                    onClick={() => setText(badge)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-600 rounded-lg cursor-pointer transition-colors"
                  >
                    {badge}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Posición
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'diagonal', label: 'Diagonal 45°' },
                  { id: 'center', label: 'Centro 0°' },
                  { id: 'repeat', label: 'Mosaico' },
                ].map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => {
                      setPosition(pos.id as any);
                      if (pos.id === 'center') setRotation(0);
                      if (pos.id === 'diagonal') setRotation(45);
                    }}
                    className={`py-2 px-1 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                      position === pos.id
                        ? 'border-purple-600 bg-purple-50 text-purple-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Color
                </label>
                <div className="flex items-center gap-2">
                  {['#e5322d', '#94a3b8', '#1e293b', '#2563eb', '#16a34a'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColorHex(c)}
                      style={{ backgroundColor: c }}
                      className={`w-7 h-7 rounded-full cursor-pointer transition-transform ${
                        colorHex === c ? 'scale-125 ring-2 ring-purple-500' : 'hover:scale-110'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tamaño: {fontSize}px
                </label>
                <input
                  type="range"
                  min="20"
                  max="80"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full accent-purple-600 cursor-pointer"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Opacidad
                </label>
                <span className="text-xs font-semibold text-slate-500">
                  {Math.round(opacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="w-full accent-purple-600 cursor-pointer"
              />
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              onClick={handleApply}
              disabled={isProcessing}
              className="w-full inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-lg rounded-2xl shadow-xl shadow-brand-600/30 transition-[background-color,box-shadow] cursor-pointer disabled:bg-slate-300"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Insertando marca...</span>
                </>
              ) : (
                <>
                  <Stamp className="w-5 h-5" />
                  <span>Insertar Marca de Agua</span>
                </>
              )}
            </button>
          </div>

          {/* Live Preview column */}
          <div className="lg:col-span-7 bg-slate-200/70 p-6 rounded-3xl border border-slate-300 flex flex-col items-center justify-center">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-3">
              <Eye className="w-4 h-4" />
              <span>Vista previa en vivo (Página 1)</span>
            </div>

            <div className="relative shadow-2xl rounded-lg overflow-hidden bg-white max-w-full">
              <canvas ref={previewCanvasRef} className="block max-w-full h-auto" />

              {/* Overlay simulation of the watermark on preview */}
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
                style={{ opacity }}
              >
                {position === 'repeat' ? (
                  <div className="grid grid-cols-2 gap-16 transform -rotate-25 scale-125">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <span
                        key={`wm-tile-${i}`}
                        style={{
                          fontSize: `${fontSize * 0.55}px`,
                          color: colorHex,
                          fontWeight: 800,
                        }}
                      >
                        {text}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span
                    style={{
                      transform: `rotate(${position === 'diagonal' ? -rotation : 0}deg)`,
                      fontSize: `${fontSize * 0.8}px`,
                      color: colorHex,
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {text}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
