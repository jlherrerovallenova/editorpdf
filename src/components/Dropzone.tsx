import React, { useRef, useState } from 'react';
import { UploadCloud, FileUp, Plus, AlertCircle } from 'lucide-react';

interface DropzoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  title?: string;
  buttonLabel?: string;
  subtitle?: string;
  maxFiles?: number;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  onFilesSelected,
  accept = '.pdf,application/pdf',
  multiple = false,
  title = 'Seleccionar archivos PDF',
  buttonLabel,
  subtitle = 'o arrastra y suelta los documentos aquí',
  maxFiles,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const validateAndProcessFiles = (fileList: FileList | File[]) => {
    setErrorMsg(null);
    const filesArray = Array.from(fileList);

    if (filesArray.length === 0) return;

    if (!multiple && filesArray.length > 1) {
      filesArray.splice(1);
    }

    if (maxFiles && filesArray.length > maxFiles) {
      setErrorMsg(`Solo puedes seleccionar hasta ${maxFiles} archivos a la vez.`);
      return;
    }

    onFilesSelected(filesArray);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndProcessFiles(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndProcessFiles(e.target.files);
    }
    // Reset value so user can upload same file again if desired
    e.target.value = '';
  };

  return (
    <div className="w-full max-w-3xl mx-auto my-8">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-200 ${
          isDragging
            ? 'border-brand-500 bg-brand-50/60 scale-[1.01] shadow-xl shadow-brand-500/10'
            : 'border-slate-300 hover:border-brand-400 bg-white shadow-xs'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center space-y-5">
          <div className="w-20 h-20 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shadow-inner group">
            <UploadCloud className="w-10 h-10 transition-transform group-hover:scale-110" />
          </div>

          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-8 py-4 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold text-lg rounded-2xl shadow-lg shadow-brand-600/30 hover:shadow-brand-600/40 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <FileUp className="w-5 h-5" />
              {buttonLabel || title}
            </button>
          </div>

          <p className="text-slate-500 text-sm font-medium">{subtitle}</p>

          {errorMsg && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center gap-6 pt-2 text-xs text-slate-400">
            <span className="flex items-center gap-1">🔒 Procesamiento local 100% privado</span>
            <span>•</span>
            <span className="flex items-center gap-1">⚡ Sin límites de tamaño de archivo</span>
          </div>
        </div>
      </div>
    </div>
  );
};
