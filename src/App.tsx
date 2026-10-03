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
    <div className="min-h-screen flex flex-col bg-slate-50 font-['Inter',sans-serif]">
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
      </main>

      {/* Footer */}
      <Footer onSelectTool={handleSelectTool} />
    </div>
  );
}

export default App;
