import React, { useState } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ToolGrid } from './components/ToolGrid';
import { MergeTool } from './tools/MergeTool';
import { SplitTool } from './tools/SplitTool';
import { OrganizeTool } from './tools/OrganizeTool';
import { EditTool } from './tools/EditTool';
import { CompressTool } from './tools/CompressTool';
import { ImageToPdfTool } from './tools/ImageToPdfTool';
import { PdfToImageTool } from './tools/PdfToImageTool';
import { WatermarkTool } from './tools/WatermarkTool';
import { ProtectTool } from './tools/ProtectTool';
import { PageNumberTool } from './tools/PageNumberTool';
import { OcrTool } from './tools/OcrTool';
import { CompareTool } from './tools/CompareTool';
import { UnlockTool } from './tools/UnlockTool';
import { PdfToWordTool } from './tools/PdfToWordTool';
import { CropTool } from './tools/CropTool';
import { AnonymizeTool } from './tools/AnonymizeTool';
import { useEffect } from 'react';
import type { ToolId } from './types';

export function App() {
  const [currentTool, setCurrentTool] = useState<ToolId | null>(() => {
    const param = new URLSearchParams(window.location.search).get('tool');
    return (param as ToolId) || null;
  });

  useEffect(() => {
    const handlePopState = () => {
      const param = new URLSearchParams(window.location.search).get('tool');
      setCurrentTool((param as ToolId) || null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSelectTool = (id: ToolId | null) => {
    setCurrentTool(id);
    const url = id ? `?tool=${id}` : window.location.pathname;
    window.history.pushState(null, '', url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fafbfd] font-sans antialiased relative selection:bg-indigo-600 selection:text-white">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-tr from-indigo-500/10 via-purple-500/10 to-sky-400/10 blur-[130px] rounded-full" />
        <div className="absolute top-[40%] -left-40 w-[600px] h-[600px] bg-indigo-500/5 blur-[140px] rounded-full" />
        <div className="absolute top-[60%] -right-40 w-[600px] h-[600px] bg-violet-500/5 blur-[140px] rounded-full" />
      </div>

      {/* Top Navigation */}
      <Header currentTool={currentTool} onSelectTool={handleSelectTool} />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentTool === null && <ToolGrid onSelectTool={handleSelectTool} />}
        {currentTool === 'merge' && <MergeTool onHome={() => handleSelectTool(null)} />}
        {currentTool === 'split' && <SplitTool onHome={() => handleSelectTool(null)} />}
        {currentTool === 'organize' && <OrganizeTool onHome={() => handleSelectTool(null)} />}
        {currentTool === 'edit' && <EditTool onHome={() => handleSelectTool(null)} />}
        {currentTool === 'compress' && <CompressTool onHome={() => handleSelectTool(null)} />}
        {currentTool === 'img-to-pdf' && <ImageToPdfTool onHome={() => handleSelectTool(null)} />}
        {currentTool === 'pdf-to-img' && <PdfToImageTool onHome={() => handleSelectTool(null)} />}
        {currentTool === 'watermark' && <WatermarkTool onHome={() => handleSelectTool(null)} />}
        {currentTool === 'protect' && <ProtectTool onHome={() => handleSelectTool(null)} />}
        {currentTool === 'page-number' && <PageNumberTool onHome={() => handleSelectTool(null)} />}
        {currentTool === 'ocr' && <OcrTool onHome={() => handleSelectTool(null)} />}
        {currentTool === 'compare' && <CompareTool onHome={() => handleSelectTool(null)} />}
        {currentTool === 'unlock' && <UnlockTool onHome={() => handleSelectTool(null)} />}
        {currentTool === 'pdf-to-word' && <PdfToWordTool onHome={() => handleSelectTool(null)} />}
        {currentTool === 'crop' && <CropTool onHome={() => handleSelectTool(null)} />}
        {currentTool === 'anonymize' && <AnonymizeTool onHome={() => handleSelectTool(null)} />}
      </main>

      {/* Footer */}
      <Footer onSelectTool={handleSelectTool} />
    </div>
  );
}

export default App;
