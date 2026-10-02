import React, { useState } from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { Dropzone } from '../components/Dropzone';
import { SuccessView } from '../components/SuccessView';
import { protectPdf, downloadBlob } from '../utils/pdfUtils';

interface ProtectToolProps {
  onHome: () => void;
}

export const ProtectTool: React.FC<ProtectToolProps> = ({ onHome }) => {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultData, setResultData] = useState<Uint8Array | null>(null);

  const handleFileSelected = (files: File[]) => {
    if (files.length === 0) return;
    setFile(files[0]);
    setErrorMsg(null);
  };

  const handleProtect = async () => {
    if (!file) return;

    if (!password) {
      setErrorMsg('Por favor escribe una contraseña para proteger el PDF.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden. Por favor verifícalas.');
      return;
    }

    if (password.length < 4) {
      setErrorMsg('La contraseña debe tener al menos 4 caracteres.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const freshBuffer = await file.arrayBuffer();
      const protectedBytes = await protectPdf(freshBuffer, password);
      setResultData(protectedBytes);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Error al proteger y cifrar el archivo PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultData || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    downloadBlob(resultData, `${baseName}_protegido.pdf`);
  };

  const handleReset = () => {
    setFile(null);
    setPassword('');
    setConfirmPassword('');
    setResultData(null);
    setErrorMsg(null);
  };

  if (resultData) {
    return (
      <SuccessView
        title="¡Tu archivo PDF está protegido!"
        subtitle="Se ha aplicado un cifrado estándar de seguridad. Guarda bien la clave para no perder el acceso."
        onDownload={handleDownload}
        onReset={handleReset}
        onHome={onHome}
        downloadLabel="Descargar PDF Protegido"
      />
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      {/* Title */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 mb-3 shadow-inner">
          <Lock className="w-7 h-7" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Proteger archivo PDF
        </h1>
        <p className="text-slate-500 mt-2 text-base">
          Añade una contraseña para evitar que personas no autorizadas puedan abrir o leer tu documento.
        </p>
      </div>

      {!file ? (
        <Dropzone
          onFilesSelected={handleFileSelected}
          multiple={false}
          title="Seleccionar archivo PDF"
          subtitle="o arrastra un PDF aquí para protegerlo con contraseña"
        />
      ) : (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                <FileCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate max-w-xs">
                  {file.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Listo para ser cifrado</p>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="text-xs font-semibold text-slate-500 hover:text-red-600 cursor-pointer"
            >
              Cambiar archivo
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Introduce la contraseña"
                  className="w-full px-4 py-3.5 pr-11 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Repetir Contraseña
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Vuelve a escribir la contraseña"
                className="w-full px-4 py-3.5 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-start gap-3 text-xs text-indigo-900">
            <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <p>
              Cifrado estándar RC4 de 128 bits. Una vez protegido, cualquier visor (Adobe Acrobat, Chrome, Edge) solicitará la contraseña para abrirlo.
            </p>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 border border-red-200 rounded-2xl text-sm font-semibold">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            onClick={handleProtect}
            disabled={isProcessing}
            className="w-full inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-lg rounded-2xl shadow-xl shadow-brand-600/30 transition-[background-color,box-shadow] cursor-pointer disabled:bg-slate-300"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Cifrando documento...</span>
              </>
            ) : (
              <>
                <Lock className="w-5 h-5" />
                <span>Proteger PDF</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
