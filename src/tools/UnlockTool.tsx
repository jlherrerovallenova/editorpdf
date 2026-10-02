import React, { useState } from 'react';
import {
  Unlock,
  Eye,
  EyeOff,
  ShieldAlert,
  Loader2,
  AlertCircle,
  FileCheck,
  CheckCircle2,
} from 'lucide-react';
import { Dropzone } from '../components/Dropzone';
import { SuccessView } from '../components/SuccessView';
import { unlockPdf, checkPdfPassword, downloadBlob, formatFileSize } from '../utils/pdfUtils';

interface UnlockToolProps {
  onHome: () => void;
}

export const UnlockTool: React.FC<UnlockToolProps> = ({ onHome }) => {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isEncrypted, setIsEncrypted] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultData, setResultData] = useState<Uint8Array | null>(null);

  const handleFileSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const selected = files[0];
    setFile(selected);
    setErrorMsg(null);
    setPassword('');
    setIsChecking(true);

    try {
      const buffer = await selected.arrayBuffer();
      const status = await checkPdfPassword(buffer, '');
      setIsEncrypted(status.isEncrypted);
    } catch {
      setIsEncrypted(true);
    } finally {
      setIsChecking(false);
    }
  };

  const handleUnlock = async () => {
    if (!file) return;

    if (isEncrypted && !password.trim()) {
      setErrorMsg('Por favor introduce la contraseña del documento para desbloquearlo.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const freshBuffer = await file.arrayBuffer();
      const unlockedBytes = await unlockPdf(freshBuffer, password);
      setResultData(unlockedBytes);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(
        err?.message?.includes('incorrecta')
          ? 'Contraseña incorrecta. Por favor verifica la clave e inténtalo de nuevo.'
          : err?.message || 'Error al desbloquear el archivo PDF.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultData || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    downloadBlob(resultData, `${baseName}_desbloqueado.pdf`);
  };

  const handleReset = () => {
    setFile(null);
    setPassword('');
    setResultData(null);
    setErrorMsg(null);
    setIsEncrypted(true);
  };

  if (resultData) {
    return (
      <SuccessView
        title="¡Tu PDF ha sido desbloqueado!"
        subtitle="Se ha eliminado la protección por contraseña. Ya puedes abrirlo y compartirlo libremente."
        onDownload={handleDownload}
        onReset={handleReset}
        onHome={onHome}
        downloadLabel="Descargar PDF Desbloqueado"
      />
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      {/* Title */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-100 text-cyan-600 mb-3 shadow-inner">
          <Unlock className="w-7 h-7" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Desbloquear PDF
        </h1>
        <p className="text-slate-500 mt-2 text-base">
          Quita la contraseña de seguridad a tus documentos para poder verlos e imprimirlos sin restricciones.
        </p>
      </div>

      {!file ? (
        <Dropzone
          onFilesSelected={handleFileSelected}
          multiple={false}
          title="Seleccionar archivo PDF protegido"
          subtitle="o arrastra el PDF con contraseña aquí para desbloquearlo"
        />
      ) : (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600">
                <FileCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate max-w-xs">
                  {file.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tamaño: {formatFileSize(file.size)}
                </p>
              </div>
            </div>

            <button
              onClick={handleReset}
              disabled={isProcessing}
              className="text-xs font-semibold text-slate-500 hover:text-red-600 cursor-pointer disabled:opacity-50"
            >
              Cambiar archivo
            </button>
          </div>

          {isChecking ? (
            <div className="flex items-center justify-center gap-3 py-6 text-sm text-slate-500 font-semibold">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-600" />
              <span>Analizando seguridad del archivo...</span>
            </div>
          ) : !isEncrypted ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-sm text-emerald-800 font-medium">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Este PDF no está protegido</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  El archivo no requiere ninguna clave para abrirse. Puedes descargarlo directamente o seleccionar otro documento.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="unlock-password-input"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Contraseña actual del PDF
                </label>
                <div className="relative">
                  <input
                    id="unlock-password-input"
                    aria-label="Contraseña actual del PDF"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Introduce la contraseña para desbloquear"
                    className="w-full px-4 py-3.5 pr-11 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-cyan-50/70 border border-cyan-100 rounded-2xl flex items-start gap-3 text-xs text-cyan-900">
                <ShieldAlert className="w-5 h-5 text-cyan-600 shrink-0 mt-0.5" />
                <p>
                  Introduce la clave una única vez. Generaremos una copia limpia sin cifrado para que no vuelvas a necesitar introducir la contraseña nunca más.
                </p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 border border-red-200 rounded-2xl text-sm font-semibold">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            onClick={handleUnlock}
            disabled={isProcessing || isChecking}
            className="w-full inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold text-lg rounded-2xl shadow-xl shadow-cyan-600/25 transition-[background-color,box-shadow] cursor-pointer disabled:bg-slate-300"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Desbloqueando documento...</span>
              </>
            ) : (
              <>
                <Unlock className="w-5 h-5" />
                <span>Desbloquear PDF</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
