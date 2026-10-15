import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { pdfjsLib } from './pdfWorker';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt-lite';
import JSZip from 'jszip';
import { createWorker } from 'tesseract.js';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak } from 'docx';
import type { Annotation, PageInfo } from '../types';

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function downloadBlob(data: Uint8Array | Blob, filename: string, mimeType = 'application/pdf') {
  const blob = data instanceof Blob ? data : new Blob([data as Uint8Array<ArrayBuffer>], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Convert hex color #RRGGBB to pdf-lib rgb(r, g, b)
function hexToRgbColor(hex: string) {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

// Safely clone ArrayBuffer or Uint8Array so Web Worker transfer cannot detach the original
export function clonePdfData(pdfData: ArrayBuffer | Uint8Array): Uint8Array {
  if (pdfData instanceof Uint8Array) {
    const copy = new Uint8Array(pdfData.byteLength);
    copy.set(pdfData);
    return copy;
  }
  // If ArrayBuffer
  const slice = pdfData.slice(0);
  return new Uint8Array(slice);
}

// Get loaded PDF.js document
export async function getPdfJsDocument(pdfData: ArrayBuffer | Uint8Array) {
  const cloned = clonePdfData(pdfData);
  const loadingTask = pdfjsLib.getDocument({
    data: cloned,
    cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdfjs-dist/3.11.174/cmaps/',
    cMapPacked: true,
  });
  return await loadingTask.promise;
}

// Render a single PDF page to a canvas and return dataUrl and dimensions
export async function renderPdfPageToDataUrl(
  pdfData: ArrayBuffer | Uint8Array,
  pageNumber: number,
  scale = 1.0
): Promise<{ dataUrl: string; width: number; height: number }> {
  const pdfJsDoc = await getPdfJsDocument(pdfData);
  const page = await pdfJsDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not get canvas context');

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  // Clear canvas to white background
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: context,
    viewport: viewport,
  }).promise;

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.85),
    width: viewport.width,
    height: viewport.height,
  };
}

// Extract thumbnails for all pages
export async function extractAllThumbnails(
  pdfData: ArrayBuffer | Uint8Array,
  onProgress?: (current: number, total: number) => void
): Promise<PageInfo[]> {
  const pdfJsDoc = await getPdfJsDocument(pdfData);
  const total = pdfJsDoc.numPages;
  const pages: PageInfo[] = [];

  for (let i = 1; i <= total; i++) {
    const page = await pdfJsDoc.getPage(i);
    // Scale for thumbnail
    const unscaledViewport = page.getViewport({ scale: 1 });
    const targetWidth = 240;
    const scale = targetWidth / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) continue;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    pages.push({
      pageNumber: i,
      rotation: 0,
      thumbnailUrl: canvas.toDataURL('image/jpeg', 0.8),
    });

    if (onProgress) {
      onProgress(i, total);
    }
  }

  return pages;
}

// 1. MERGE PDFs
export async function mergePdfs(files: { data: ArrayBuffer; name: string }[]): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    const pdf = await PDFDocument.load(file.data, { ignoreEncryption: true });
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  return await mergedPdf.save();
}

// 2. SPLIT PDF
export async function splitPdf(
  pdfData: ArrayBuffer,
  mode: 'all' | 'ranges' | 'extract',
  options?: { ranges?: string; selectedPages?: number[]; baseName?: string }
): Promise<{ name: string; data: Uint8Array }[]> {
  const originalPdf = await PDFDocument.load(pdfData, { ignoreEncryption: true });
  const totalPages = originalPdf.getPageCount();
  const baseName = options?.baseName || 'documento';
  const results: { name: string; data: Uint8Array }[] = [];

  if (mode === 'all') {
    // Each page in its own PDF
    for (let i = 0; i < totalPages; i++) {
      const subPdf = await PDFDocument.create();
      const [copiedPage] = await subPdf.copyPages(originalPdf, [i]);
      subPdf.addPage(copiedPage);
      const data = await subPdf.save();
      results.push({
        name: `${baseName}_pagina_${i + 1}.pdf`,
        data,
      });
    }
  } else if (mode === 'extract') {
    // Extract only selected pages into one single or multiple PDFs
    const selected = (options?.selectedPages || []).filter((p) => p >= 1 && p <= totalPages);
    if (selected.length === 0) throw new Error('No se han seleccionado páginas válidas');

    const subPdf = await PDFDocument.create();
    const copiedPages = await subPdf.copyPages(
      originalPdf,
      selected.map((p) => p - 1)
    );
    copiedPages.forEach((p) => subPdf.addPage(p));
    const data = await subPdf.save();
    results.push({
      name: `${baseName}_extraido.pdf`,
      data,
    });
  } else if (mode === 'ranges') {
    // Parse range string: e.g. "1-3, 4-5, 6"
    const rawRanges = (options?.ranges || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (rawRanges.length === 0) throw new Error('Introduce al menos un rango de páginas (ej: 1-3, 4-6)');

    for (let idx = 0; idx < rawRanges.length; idx++) {
      const rangeStr = rawRanges[idx];
      let pageIndices: number[] = [];

      if (rangeStr.includes('-')) {
        const [startStr, endStr] = rangeStr.split('-').map((s) => parseInt(s.trim(), 10));
        if (isNaN(startStr) || isNaN(endStr)) continue;
        const start = Math.max(1, Math.min(startStr, endStr));
        const end = Math.min(totalPages, Math.max(startStr, endStr));
        for (let p = start; p <= end; p++) {
          pageIndices.push(p - 1);
        }
      } else {
        const p = parseInt(rangeStr, 10);
        if (!isNaN(p) && p >= 1 && p <= totalPages) {
          pageIndices.push(p - 1);
        }
      }

      if (pageIndices.length > 0) {
        const subPdf = await PDFDocument.create();
        const copiedPages = await subPdf.copyPages(originalPdf, pageIndices);
        copiedPages.forEach((page) => subPdf.addPage(page));
        const data = await subPdf.save();
        results.push({
          name: `${baseName}_rango_${rangeStr}.pdf`,
          data,
        });
      }
    }
  }

  if (results.length === 0) {
    throw new Error('No se generó ningún archivo con las opciones seleccionadas');
  }

  return results;
}

// 3. ORGANIZE PDF (Reorder, Rotate, Delete pages)
export async function organizePdf(
  pdfData: ArrayBuffer,
  pageList: { originalIndex: number; rotation: number; isDeleted?: boolean }[]
): Promise<Uint8Array> {
  const [originalPdf, newPdf] = await Promise.all([
    PDFDocument.load(pdfData, { ignoreEncryption: true }),
    PDFDocument.create(),
  ]);

  const activePages = pageList.filter((p) => !p.isDeleted);
  if (activePages.length === 0) {
    throw new Error('No puedes eliminar todas las páginas del documento');
  }

  for (const item of activePages) {
    const [copiedPage] = await newPdf.copyPages(originalPdf, [item.originalIndex]);
    const currentAngle = copiedPage.getRotation().angle;
    const finalAngle = (currentAngle + item.rotation) % 360;
    copiedPage.setRotation(degrees(finalAngle));
    newPdf.addPage(copiedPage);
  }

  return await newPdf.save();
}

// 4. IMAGES TO PDF
export async function imagesToPdf(
  images: { dataUrl: string; width: number; height: number; type: string }[],
  options: {
    orientation: 'portrait' | 'landscape' | 'fit';
    pageSize: 'a4' | 'fit';
    margin: number;
  }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  for (const imgItem of images) {
    let embeddedImg;
    if (imgItem.type === 'image/jpeg' || imgItem.type === 'image/jpg') {
      embeddedImg = await pdfDoc.embedJpg(imgItem.dataUrl);
    } else {
      embeddedImg = await pdfDoc.embedPng(imgItem.dataUrl);
    }

    const imgWidth = imgItem.width;
    const imgHeight = imgItem.height;

    let pageWidth = imgWidth;
    let pageHeight = imgHeight;

    if (options.pageSize === 'a4') {
      // Standard A4 is 595.28 x 841.89 points
      const a4W = 595.28;
      const a4H = 841.89;

      let isLandscape = options.orientation === 'landscape';
      if (options.orientation === 'fit') {
        isLandscape = imgWidth > imgHeight;
      }

      pageWidth = isLandscape ? a4H : a4W;
      pageHeight = isLandscape ? a4W : a4H;

      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      const availableW = pageWidth - options.margin * 2;
      const availableH = pageHeight - options.margin * 2;
      const scale = Math.min(availableW / imgWidth, availableH / imgHeight, 1.0);

      const drawW = imgWidth * scale;
      const drawH = imgHeight * scale;
      const posX = (pageWidth - drawW) / 2;
      const posY = (pageHeight - drawH) / 2;

      page.drawImage(embeddedImg, {
        x: posX,
        y: posY,
        width: drawW,
        height: drawH,
      });
    } else {
      // Fit to image with optional margin
      const margin = options.margin;
      pageWidth = imgWidth + margin * 2;
      pageHeight = imgHeight + margin * 2;

      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      page.drawImage(embeddedImg, {
        x: margin,
        y: margin,
        width: imgWidth,
        height: imgHeight,
      });
    }
  }

  return await pdfDoc.save();
}

// 5. PDF TO IMAGES
export async function getPdfPageCount(data: ArrayBuffer | File): Promise<number> {
  try {
    const buffer = data instanceof File ? await data.arrayBuffer() : data;
    const doc = await getPdfJsDocument(buffer);
    return doc.numPages;
  } catch {
    return 1;
  }
}

export async function renderPdfPageToBlob(
  page: any,
  scale: number,
  format: 'image/jpeg' | 'image/png',
  quality: number
): Promise<Blob> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('No se pudo obtener el contexto 2D del canvas');
  }

  // Draw white background
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: context,
    viewport: viewport,
  }).promise;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Error al generar blob de la imagen'));
      },
      format,
      quality
    );
  });

  // Explicitly free canvas memory
  canvas.width = 0;
  canvas.height = 0;
  if (typeof (page as any).cleanup === 'function') {
    (page as any).cleanup();
  }

  return blob;
}

export async function pdfToImages(
  pdfData: ArrayBuffer,
  format: 'image/jpeg' | 'image/png' = 'image/jpeg',
  scale = 2.0,
  quality = 0.9,
  baseName = 'pagina',
  onProgress?: (current: number, total: number) => void
): Promise<{ name: string; blob: Blob; dataUrl: string }[]> {
  const pdfJsDoc = await getPdfJsDocument(pdfData);
  const total = pdfJsDoc.numPages;
  const results: { name: string; blob: Blob; dataUrl: string }[] = [];
  const ext = format === 'image/jpeg' ? 'jpg' : 'png';

  for (let i = 1; i <= total; i++) {
    const page = await pdfJsDoc.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) continue;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    const dataUrl = canvas.toDataURL(format, quality);
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b || new Blob()), format, quality);
    });

    // Free canvas
    canvas.width = 0;
    canvas.height = 0;
    if (typeof (page as any).cleanup === 'function') {
      (page as any).cleanup();
    }

    results.push({
      name: `${baseName}_${i}.${ext}`,
      blob,
      dataUrl,
    });

    if (onProgress) {
      onProgress(i, total);
    }
  }

  return results;
}

export interface BatchPdfConvertItem {
  id: string;
  name: string;
  file: File;
}

export interface BatchConvertProgressInfo {
  fileIndex: number;
  totalFiles: number;
  fileName: string;
  pageIndex: number;
  totalPagesInFile: number;
  totalProcessedPages: number;
  totalEstimatedPages: number;
  percentage: number;
  statusText: string;
}

export interface BatchConvertOptions {
  format?: 'image/jpeg' | 'image/png';
  scale?: number;
  quality?: number;
  pageScope?: 'all' | 'first';
  folderStructure?: 'folders' | 'flat';
  onProgress?: (info: BatchConvertProgressInfo) => void;
  signal?: AbortSignal;
}

export interface ConvertedPageItem {
  pageNumber: number;
  name: string;
  blob: Blob;
  previewUrl: string;
}

export interface ConvertedPdfResult {
  id: string;
  fileName: string;
  baseName: string;
  pageCount: number;
  images: ConvertedPageItem[];
  error?: string;
}

export interface BatchConvertSummary {
  results: ConvertedPdfResult[];
  masterZipBlob: Blob;
  totalImages: number;
  totalPdfCount: number;
  failedCount: number;
}

export async function batchConvertPdfToImages(
  items: BatchPdfConvertItem[],
  options: BatchConvertOptions = {}
): Promise<BatchConvertSummary> {
  const format = options.format || 'image/jpeg';
  const scale = options.scale || 1.5;
  const quality = options.quality ?? 0.92;
  const pageScope = options.pageScope || 'all';
  const folderStructure = options.folderStructure || 'folders';
  const ext = format === 'image/jpeg' ? 'jpg' : 'png';

  const masterZip = new JSZip();
  const results: ConvertedPdfResult[] = [];
  let totalImages = 0;
  let failedCount = 0;

  options.onProgress?.({
    fileIndex: 0,
    totalFiles: items.length,
    fileName: '',
    pageIndex: 0,
    totalPagesInFile: 0,
    totalProcessedPages: 0,
    totalEstimatedPages: items.length,
    percentage: 2,
    statusText: 'Preparando cola de archivos PDF...',
  });

  // Calculate pages or estimate
  let totalEstimatedPages = 0;
  const preppedFiles: { item: BatchPdfConvertItem; buffer?: ArrayBuffer; numPages: number }[] = [];

  for (let i = 0; i < items.length; i++) {
    if (options.signal?.aborted) {
      throw new DOMException('Conversión cancelada por el usuario', 'AbortError');
    }
    const it = items[i];
    try {
      const buf = await it.file.arrayBuffer();
      const pDoc = await getPdfJsDocument(buf);
      const docPages = pDoc.numPages;
      const willExtract = pageScope === 'first' ? 1 : docPages;
      totalEstimatedPages += willExtract;
      preppedFiles.push({ item: it, buffer: buf, numPages: docPages });
    } catch {
      preppedFiles.push({ item: it, numPages: 1 });
      totalEstimatedPages += 1;
    }
  }

  let totalProcessedPages = 0;

  for (let fileIdx = 0; fileIdx < preppedFiles.length; fileIdx++) {
    if (options.signal?.aborted) {
      throw new DOMException('Conversión cancelada por el usuario', 'AbortError');
    }

    const { item, buffer } = preppedFiles[fileIdx];
    const rawBaseName = item.name.replace(/\.[^/.]+$/, '').trim() || `documento_${fileIdx + 1}`;
    const safeBaseName = rawBaseName.replace(/[\\/:*?"<>|]/g, '_');

    try {
      const pdfBuffer = buffer || (await item.file.arrayBuffer());
      const pdfDoc = await getPdfJsDocument(pdfBuffer);
      const totalPagesInDoc = pdfDoc.numPages;
      const pagesToExtract = pageScope === 'first' ? [1] : Array.from({ length: totalPagesInDoc }, (_, idx) => idx + 1);

      const fileImages: ConvertedPageItem[] = [];

      for (let pIdx = 0; pIdx < pagesToExtract.length; pIdx++) {
        if (options.signal?.aborted) {
          throw new DOMException('Conversión cancelada por el usuario', 'AbortError');
        }

        const pageNum = pagesToExtract[pIdx];

        options.onProgress?.({
          fileIndex: fileIdx + 1,
          totalFiles: preppedFiles.length,
          fileName: item.name,
          pageIndex: pIdx + 1,
          totalPagesInFile: pagesToExtract.length,
          totalProcessedPages,
          totalEstimatedPages,
          percentage: Math.min(92, Math.round((totalProcessedPages / Math.max(1, totalEstimatedPages)) * 90) + 4),
          statusText: `Convirtiendo "${item.name}": página ${pageNum} de ${totalPagesInDoc}...`,
        });

        const page = await pdfDoc.getPage(pageNum);
        const blob = await renderPdfPageToBlob(page, scale, format, quality);
        const previewUrl = URL.createObjectURL(blob);
        const imageName = `${safeBaseName}_pagina_${pageNum}.${ext}`;

        fileImages.push({
          pageNumber: pageNum,
          name: imageName,
          blob,
          previewUrl,
        });

        // Add to master zip
        if (folderStructure === 'folders' && preppedFiles.length > 1) {
          masterZip.folder(safeBaseName)?.file(imageName, blob);
        } else {
          masterZip.file(imageName, blob);
        }

        totalProcessedPages++;
        totalImages++;
      }

      results.push({
        id: item.id,
        fileName: item.name,
        baseName: safeBaseName,
        pageCount: totalPagesInDoc,
        images: fileImages,
      });
    } catch (err: any) {
      console.error(`Error procesando archivo ${item.name}:`, err);
      failedCount++;
      results.push({
        id: item.id,
        fileName: item.name,
        baseName: safeBaseName,
        pageCount: 0,
        images: [],
        error: err?.message || 'Error al procesar el archivo PDF (puede estar protegido o corrupto).',
      });
    }
  }

  options.onProgress?.({
    fileIndex: preppedFiles.length,
    totalFiles: preppedFiles.length,
    fileName: '',
    pageIndex: 0,
    totalPagesInFile: 0,
    totalProcessedPages,
    totalEstimatedPages,
    percentage: 94,
    statusText: 'Generando archivo comprimido ZIP...',
  });

  const masterZipBlob = await masterZip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 4 } },
    (metadata) => {
      options.onProgress?.({
        fileIndex: preppedFiles.length,
        totalFiles: preppedFiles.length,
        fileName: '',
        pageIndex: 0,
        totalPagesInFile: 0,
        totalProcessedPages,
        totalEstimatedPages,
        percentage: Math.min(99, 93 + Math.round(metadata.percent * 0.06)),
        statusText: `Comprimiendo archivo ZIP... ${Math.round(metadata.percent)}%`,
      });
    }
  );

  return {
    results,
    masterZipBlob,
    totalImages,
    totalPdfCount: items.length,
    failedCount,
  };
}

// Helper to create ZIP file from multiple files
export async function createZip(files: { name: string; blob: Blob | Uint8Array }[]): Promise<Blob> {
  const zip = new JSZip();
  files.forEach((f) => {
    zip.file(f.name, f.blob);
  });
  return await zip.generateAsync({ type: 'blob' });
}

// 6. WATERMARK PDF
export async function addWatermarkToPdf(
  pdfData: ArrayBuffer,
  options: {
    text: string;
    fontSize: number;
    opacity: number;
    rotation: number;
    colorHex: string;
    position: 'center' | 'diagonal' | 'repeat';
  }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfData, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const color = hexToRgbColor(options.colorHex);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(options.text, options.fontSize);
    const textHeight = font.heightAtSize(options.fontSize);

    if (options.position === 'center' || options.position === 'diagonal') {
      const angle = options.position === 'diagonal' ? degrees(options.rotation || 45) : degrees(options.rotation || 0);
      page.drawText(options.text, {
        x: (width - textWidth) / 2,
        y: (height - textHeight) / 2,
        size: options.fontSize,
        font,
        color,
        opacity: options.opacity,
        rotate: angle,
      });
    } else if (options.position === 'repeat') {
      const stepX = textWidth + 80;
      const stepY = textHeight + 80;
      for (let x = 30; x < width; x += stepX) {
        for (let y = 30; y < height; y += stepY) {
          page.drawText(options.text, {
            x,
            y,
            size: options.fontSize * 0.75,
            font,
            color,
            opacity: options.opacity * 0.7,
            rotate: degrees(options.rotation || 30),
          });
        }
      }
    }
  }

  return await pdfDoc.save();
}

// 7. COMPRESS PDF
// Converts pages to compressed JPEG bitmaps and wraps them back into an optimized PDF
export async function compressPdf(
  pdfData: ArrayBuffer,
  qualityLevel: 'extreme' | 'recommended' | 'low',
  onProgress?: (current: number, total: number) => void
): Promise<{ data: Uint8Array; originalSize: number; newSize: number; savedPercentage: number }> {
  const originalSize = pdfData.byteLength;
  const pdfJsDoc = await getPdfJsDocument(pdfData);
  const total = pdfJsDoc.numPages;

  let scale = 1.5;
  let quality = 0.75;

  if (qualityLevel === 'extreme') {
    scale = 1.0;
    quality = 0.5;
  } else if (qualityLevel === 'recommended') {
    scale = 1.25;
    quality = 0.7;
  } else {
    // Low compression (higher quality)
    scale = 1.8;
    quality = 0.85;
  }

  const newPdf = await PDFDocument.create();

  for (let i = 1; i <= total; i++) {
    const page = await pdfJsDoc.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) continue;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const embeddedImg = await newPdf.embedJpg(dataUrl);

    // Maintain original page size proportions
    const origViewport = page.getViewport({ scale: 1 });
    const newPage = newPdf.addPage([origViewport.width, origViewport.height]);
    newPage.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: origViewport.width,
      height: origViewport.height,
    });

    if (onProgress) {
      onProgress(i, total);
    }
  }

  const compressedBytes = await newPdf.save();
  const newSize = compressedBytes.byteLength;
  const savedPercentage = Math.max(0, Math.round(((originalSize - newSize) / originalSize) * 100));

  return {
    data: compressedBytes,
    originalSize,
    newSize,
    savedPercentage,
  };
}

// 8. PROTECT PDF (Password protect)
export async function protectPdf(pdfData: ArrayBuffer, password: string): Promise<Uint8Array> {
  if (!password || password.trim().length === 0) {
    throw new Error('La contraseña no puede estar vacía');
  }

  const encryptedBytes = await encryptPDF(new Uint8Array(pdfData), password, {
    ownerPassword: password,
  });

  return encryptedBytes;
}

// 9. APPLY ANNOTATIONS / VISUAL EDITOR TO PDF
export async function applyAnnotationsToPdf(
  pdfData: ArrayBuffer,
  annotations: Annotation[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfData, { ignoreEncryption: true });
  const [fontRegular, fontBold] = await Promise.all([
    pdfDoc.embedFont(StandardFonts.Helvetica),
    pdfDoc.embedFont(StandardFonts.HelveticaBold),
  ]);
  const pages = pdfDoc.getPages();

  for (const ann of annotations) {
    if (ann.pageIndex < 0 || ann.pageIndex >= pages.length) continue;
    const page = pages[ann.pageIndex];
    const { width: pWidth, height: pHeight } = page.getSize();

    // Coordinates are percentage-based: x% from left (0 to 100), y% from top (0 to 100)
    // In PDF coordinates: origin (0, 0) is bottom-left
    const pdfX = (ann.x / 100) * pWidth;
    const pdfY = pHeight - (ann.y / 100) * pHeight;

    if (ann.type === 'text') {
      const font = ann.isBold ? fontBold : fontRegular;
      const color = hexToRgbColor(ann.color || '#000000');
      page.drawText(ann.text, {
        x: pdfX,
        y: pdfY - ann.fontSize,
        size: ann.fontSize,
        font,
        color,
      });
    } else if (ann.type === 'image') {
      try {
        let img;
        if (ann.dataUrl.includes('image/png')) {
          img = await pdfDoc.embedPng(ann.dataUrl);
        } else {
          img = await pdfDoc.embedJpg(ann.dataUrl);
        }
        page.drawImage(img, {
          x: pdfX,
          y: pdfY - ann.height,
          width: ann.width,
          height: ann.height,
        });
      } catch (err) {
        console.warn('Could not embed image annotation:', err);
      }
    } else if (ann.type === 'rect') {
      const color = hexToRgbColor(ann.color || '#e5322d');
      page.drawRectangle({
        x: pdfX,
        y: pdfY - ann.height,
        width: ann.width,
        height: ann.height,
        borderColor: color,
        borderWidth: ann.strokeWidth || 2,
        opacity: 0.85,
      });
    } else if (ann.type === 'draw') {
      // Freehand drawing stroke
      const color = hexToRgbColor(ann.color || '#e5322d');
      const pts = ann.points;
      if (pts.length >= 2) {
        for (let i = 0; i < pts.length - 1; i++) {
          const x1 = (pts[i].x / 100) * pWidth;
          const y1 = pHeight - (pts[i].y / 100) * pHeight;
          const x2 = (pts[i + 1].x / 100) * pWidth;
          const y2 = pHeight - (pts[i + 1].y / 100) * pHeight;
          page.drawLine({
            start: { x: x1, y: y1 },
            end: { x: x2, y: y2 },
            thickness: ann.strokeWidth || 2,
            color,
          });
        }
      }
    }
  }

  return await pdfDoc.save();
}

// 10. PAGE NUMBERING
export interface PageNumberOptions {
  position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  format: 'n' | 'n_of_total' | 'page_n' | 'page_n_of_total' | 'pag_n' | 'pag_n_of_total';
  fontSize: number;
  colorHex: string;
  margin: number;
  startPage: number; // 1-indexed (e.g. 1 = all, 2 = skip first/cover)
  startNumber: number; // starting number (e.g. 1)
  customPrefix?: string;
  customSuffix?: string;
}

export function formatPageNumber(pageIndex: number, totalNumberablePages: number, options: PageNumberOptions): string {
  const currentNum = options.startNumber + pageIndex;
  const total = options.startNumber + totalNumberablePages - 1;

  switch (options.format) {
    case 'n':
      return `${currentNum}`;
    case 'n_of_total':
      return `${currentNum} / ${total}`;
    case 'page_n':
      return `Página ${currentNum}`;
    case 'page_n_of_total':
      return `Página ${currentNum} de ${total}`;
    case 'pag_n':
      return `Pág. ${currentNum}`;
    case 'pag_n_of_total':
      return `Pág. ${currentNum} de ${total}`;
    default:
      return `${currentNum}`;
  }
}

export async function addPageNumbersToPdf(
  pdfData: ArrayBuffer,
  options: PageNumberOptions
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfData, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const color = hexToRgbColor(options.colorHex || '#333333');
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;

  const startIndex = Math.max(0, options.startPage - 1);
  const numberableCount = Math.max(1, totalPages - startIndex);
  const isCenter = options.position.includes('center');
  const isRight = options.position.includes('right');
  const isTop = options.position.startsWith('top');
  const margin = options.margin || 30;

  for (let i = startIndex; i < totalPages; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    const pageOffset = i - startIndex;
    const rawText = formatPageNumber(pageOffset, numberableCount, options);
    const text = `${options.customPrefix || ''}${rawText}${options.customSuffix || ''}`;

    const textWidth = font.widthOfTextAtSize(text, options.fontSize);
    const textHeight = font.heightAtSize(options.fontSize);

    let x = margin;
    let y = margin;

    if (isCenter) {
      x = (width - textWidth) / 2;
    } else if (isRight) {
      x = width - margin - textWidth;
    } else {
      x = margin;
    }

    if (isTop) {
      y = height - margin - textHeight;
    } else {
      y = margin;
    }

    page.drawText(text, {
      x,
      y,
      size: options.fontSize,
      font,
      color,
    });
  }

  return await pdfDoc.save();
}

// 11. CHECK PDF PASSWORD & ENCRYPTION
export async function checkPdfPassword(
  pdfData: ArrayBuffer | Uint8Array,
  password = ''
): Promise<{ isEncrypted: boolean; isValid: boolean; error?: string }> {
  try {
    const cloned = clonePdfData(pdfData);
    const loadingTask = pdfjsLib.getDocument({
      data: cloned,
      password,
      cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdfjs-dist/3.11.174/cmaps/',
      cMapPacked: true,
    });
    await loadingTask.promise;
    return { isEncrypted: false, isValid: true };
  } catch (err: any) {
    if (err?.name === 'PasswordException') {
      if (err.code === 2) {
        return { isEncrypted: true, isValid: false, error: 'Contraseña incorrecta' };
      }
      return { isEncrypted: true, isValid: false, error: 'Este documento está protegido con contraseña' };
    }
    return { isEncrypted: false, isValid: false, error: err?.message || 'Error al leer el archivo PDF' };
  }
}

// 12. UNLOCK PDF (STRIP PASSWORD & RE-SAVE)
export async function unlockPdf(
  pdfData: ArrayBuffer,
  password: string
): Promise<Uint8Array> {
  const cloned = clonePdfData(pdfData);
  let pdfJsDoc;
  try {
    pdfJsDoc = await pdfjsLib.getDocument({
      data: cloned,
      password,
      cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdfjs-dist/3.11.174/cmaps/',
      cMapPacked: true,
    }).promise;
  } catch (err: any) {
    if (err?.name === 'PasswordException') {
      throw new Error('La contraseña proporcionada es incorrecta.');
    }
    throw new Error('No se pudo abrir el documento PDF cifrado: ' + (err?.message || ''));
  }

  // 1st attempt: Remove encryption trailer directly with pdf-lib
  try {
    const loadedDoc = await PDFDocument.load(pdfData, { ignoreEncryption: true });
    if ((loadedDoc.context as any)?.trailerInfo?.Encrypt) {
      delete (loadedDoc.context as any).trailerInfo.Encrypt;
    }
    const saved = await loadedDoc.save();
    const checkDoc = await PDFDocument.load(saved);
    if (!checkDoc.isEncrypted) {
      return saved;
    }
  } catch {
    // Continue to fallback
  }

  // Fallback: render verified unlocked pages to crisp vector-quality high-res PDF
  const total = pdfJsDoc.numPages;
  const newPdf = await PDFDocument.create();

  for (let i = 1; i <= total; i++) {
    const page = await pdfJsDoc.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const embedded = await newPdf.embedJpg(dataUrl);
    const origViewport = page.getViewport({ scale: 1.0 });
    const newPage = newPdf.addPage([origViewport.width, origViewport.height]);
    newPage.drawImage(embedded, {
      x: 0,
      y: 0,
      width: origViewport.width,
      height: origViewport.height,
    });
  }

  return await newPdf.save();
}

// 13. OCR (OPTICAL CHARACTER RECOGNITION)
export interface OcrResult {
  fullText: string;
  pages: {
    pageNumber: number;
    text: string;
    confidence: number;
    method?: 'digital' | 'ocr';
  }[];
}

export interface OcrOptions {
  language?: string;
  mode?: 'auto' | 'hybrid' | 'ocr';
  enhanceContrast?: boolean;
}

/**
 * Preprocesses a 2D canvas for OCR:
 * - Grayscale conversion
 * - Dynamic range histogram stretching to remove scanner gray/yellow noise
 * - Contrast boost to make text strokes dark and background pure white
 */
export function preprocessCanvasForOcr(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  try {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const len = data.length;

    // 1. Calculate luminance histogram (0..255)
    const histogram = new Uint32Array(256);
    let pixelCount = 0;
    for (let i = 0; i < len; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      histogram[gray]++;
      pixelCount++;
    }

    // 2. Find 1.5% percentile (dark text) and 98% percentile (background paper)
    const pLow = pixelCount * 0.015;
    const pHigh = pixelCount * 0.98;
    let count = 0;
    let minVal = 0;
    let maxVal = 255;

    for (let i = 0; i < 256; i++) {
      count += histogram[i];
      if (count >= pLow && minVal === 0) {
        minVal = i;
      }
      if (count >= pHigh) {
        maxVal = i;
        break;
      }
    }

    if (maxVal <= minVal + 10) {
      minVal = 0;
      maxVal = 255;
    }

    const range = Math.max(1, maxVal - minVal);

    // 3. Dynamic stretch & thresholding
    for (let i = 0; i < len; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      let normalized = ((gray - minVal) / range) * 255;
      if (normalized < 0) normalized = 0;
      if (normalized > 255) normalized = 255;

      let finalVal: number;
      if (normalized > 185) {
        finalVal = 255; // Crisp white background
      } else if (normalized < 105) {
        finalVal = Math.max(0, normalized * 0.55); // Crisp deep black text
      } else {
        // Linear curve between 105 and 185
        finalVal = normalized;
      }

      data[i] = finalVal;
      data[i + 1] = finalVal;
      data[i + 2] = finalVal;
    }

    ctx.putImageData(imgData, 0, 0);
  } catch (err) {
    console.warn('Canvas preprocessing warning:', err);
  }

  return canvas;
}

/**
 * Prepares an uploaded image file (PNG/JPG/WebP) for optimal Tesseract OCR
 */
async function prepareImageForOcr(file: File, enhanceContrast: boolean = true): Promise<HTMLCanvasElement> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  const maxDim = Math.max(img.width, img.height);
  // Target 2400px for optimal OCR character height (~300 DPI)
  const scale = maxDim < 1600 ? Math.min(3.0, 2400 / maxDim) : (maxDim > 3200 ? 3200 / maxDim : 1.0);

  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (enhanceContrast) {
      preprocessCanvasForOcr(canvas);
    }
  }

  return canvas;
}

/**
 * Clean and normalize OCR output text
 */
function sanitizeOcrText(rawText: string): string {
  return rawText
    // Fix hyphenated words at line endings (e.g. "recono- \n cimiento" -> "reconocimiento")
    .replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2')
    // Fix broken single character line endings
    .replace(/[ \t]+\n/g, '\n')
    // Remove more than 2 consecutive line breaks
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extracts native digital text from a PDF.js page with high geometric fidelity
 */
export async function extractNativeTextFromPage(
  page: any
): Promise<{ text: string; confidence: number; hasText: boolean }> {
  try {
    const textContent = await page.getTextContent({
      includeMarkedContent: false,
      disableCombineTextItems: false,
    });

    const items = textContent.items as Array<{
      str: string;
      transform: number[];
      width: number;
      height: number;
    }>;

    const validItems = items.filter((it) => it.str && it.str.trim().length > 0);
    const totalChars = validItems.reduce((acc, it) => acc + it.str.length, 0);

    // If page has fewer than 20 characters or fewer than 4 items, treat as scanned
    if (totalChars < 20 || validItems.length < 4) {
      return { text: '', confidence: 0, hasText: false };
    }

    // Group items into lines based on Y coordinate
    const lines: { y: number; items: typeof validItems }[] = [];
    const sorted = [...validItems].sort((a, b) => b.transform[5] - a.transform[5]);

    for (const item of sorted) {
      const itemY = item.transform[5];
      const itemHeight = Math.abs(item.transform[3]) || 12;
      const lineTolerance = Math.max(3, itemHeight * 0.35);

      const existingLine = lines.find((l) => Math.abs(l.y - itemY) <= lineTolerance);
      if (existingLine) {
        existingLine.items.push(item);
      } else {
        lines.push({ y: itemY, items: [item] });
      }
    }

    lines.sort((a, b) => b.y - a.y);

    const formattedLines: string[] = [];
    let prevY: number | null = null;
    const avgLineHeight = 14;

    for (const line of lines) {
      line.items.sort((a, b) => a.transform[4] - b.transform[4]);

      let lineStr = '';
      let prevRight = 0;

      for (let idx = 0; idx < line.items.length; idx++) {
        const it = line.items[idx];
        const left = it.transform[4];
        const width = it.width;

        if (idx === 0) {
          lineStr += it.str;
        } else {
          const gap = left - prevRight;
          const fontSz = Math.abs(it.transform[0]) || 12;
          const spaceThreshold = fontSz * 0.18;

          if (gap > spaceThreshold && !lineStr.endsWith(' ') && !it.str.startsWith(' ')) {
            lineStr += ' ';
          }
          lineStr += it.str;
        }
        prevRight = left + width;
      }

      lineStr = lineStr.trim();
      if (!lineStr) continue;

      if (prevY !== null) {
        const yDiff = prevY - line.y;
        if (yDiff > avgLineHeight * 1.7) {
          formattedLines.push('');
        }
      }

      formattedLines.push(lineStr);
      prevY = line.y;
    }

    const text = formattedLines.join('\n').trim();
    return {
      text,
      confidence: 100, // Native digital text is 100% exact
      hasText: text.length >= 20,
    };
  } catch (err) {
    console.warn('Native text extraction fallback to OCR:', err);
    return { text: '', confidence: 0, hasText: false };
  }
}

export async function performOcr(
  file: File,
  optionsOrLang: string | OcrOptions = 'spa',
  onProgress?: (progressText: string, percentage: number) => void
): Promise<OcrResult> {
  const options: OcrOptions =
    typeof optionsOrLang === 'string'
      ? { language: optionsOrLang, mode: 'hybrid', enhanceContrast: true }
      : { language: 'spa', mode: 'hybrid', enhanceContrast: true, ...optionsOrLang };

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const pages: { pageNumber: number; text: string; confidence: number; method?: 'digital' | 'ocr' }[] = [];

  let currentPage = 1;
  let totalPages = 1;
  let isInitializing = true;
  let worker: any = null;

  const initWorkerIfNeeded = async () => {
    if (worker) return worker;

    if (onProgress) {
      onProgress('Inicializando motor Tesseract OCR (WebAssembly)...', 5);
    }

    const lang = options.language || 'spa';
    worker = await createWorker(lang, undefined, {
      logger: (m) => {
        if (!onProgress) return;
        if (isInitializing) {
          if (m.status === 'loading tesseract core') {
            onProgress('Cargando núcleo Tesseract WebAssembly...', Math.round(5 + (m.progress || 0) * 10));
          } else if (m.status === 'loading language traineddata') {
            onProgress(`Descargando modelo lingüístico (${lang})...`, Math.round(15 + (m.progress || 0) * 15));
          } else if (m.status === 'initializing tesseract' || m.status === 'initializing api') {
            onProgress('Preparando motor Tesseract OCR...', Math.round(30 + (m.progress || 0) * 10));
          }
        } else {
          if (m.status === 'recognizing text') {
            const pageBase = ((currentPage - 1) / totalPages) * 100;
            const pageSlice = 100 / totalPages;
            const pct = Math.min(99, Math.round(pageBase + (m.progress || 0) * pageSlice));
            onProgress(
              `Página ${currentPage}/${totalPages}: Reconociendo texto con Tesseract (${Math.round((m.progress || 0) * 100)}%)...`,
              pct
            );
          }
        }
      },
    });

    // Configure Tesseract parameters for maximum accuracy and preservation of spaces
    try {
      await worker.setParameters({
        preserve_interword_spaces: '1',
        tessedit_pageseg_mode: '3', // PSM.AUTO (Fully automatic page segmentation)
      });
    } catch (e) {
      console.warn('Could not set Tesseract worker parameters:', e);
    }

    return worker;
  };

  try {
    if (isPdf) {
      const buffer = await file.arrayBuffer();
      const pdfJsDoc = await getPdfJsDocument(buffer);
      totalPages = pdfJsDoc.numPages;

      for (let i = 1; i <= totalPages; i++) {
        currentPage = i;
        const page = await pdfJsDoc.getPage(i);

        // Check if hybrid mode is active and page has digital text
        if (options.mode !== 'ocr') {
          if (onProgress) {
            onProgress(`Analizando página ${i} de ${totalPages}...`, Math.round(((i - 1) / totalPages) * 90));
          }
          const nativeRes = await extractNativeTextFromPage(page);
          if (nativeRes.hasText) {
            pages.push({
              pageNumber: i,
              text: nativeRes.text,
              confidence: 100,
              method: 'digital',
            });
            continue;
          }
        }

        // If no digital text or forcing OCR: Use high-resolution preprocessed Tesseract OCR
        await initWorkerIfNeeded();
        isInitializing = false;

        if (onProgress) {
          onProgress(
            `Renderizando página ${i} de ${totalPages} a alta resolución (300 DPI)...`,
            Math.round(((i - 0.7) / totalPages) * 90)
          );
        }

        const baseVp = page.getViewport({ scale: 1.0 });
        // Target ~2400px on the longest dimension for optimal 300 DPI character recognition
        const targetDim = 2400;
        const scale = Math.min(3.8, Math.max(2.2, targetDim / Math.max(baseVp.width, baseVp.height)));
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;

        if (options.enhanceContrast !== false) {
          preprocessCanvasForOcr(canvas);
        }

        if (onProgress) {
          onProgress(
            `Página ${i} de ${totalPages}: Ejecutando red neuronal Tesseract OCR...`,
            Math.round(((i - 0.3) / totalPages) * 90)
          );
        }

        const { data } = await worker.recognize(canvas);
        const cleanText = sanitizeOcrText(data.text);

        pages.push({
          pageNumber: i,
          text: cleanText,
          confidence: Math.round(data.confidence),
          method: 'ocr',
        });
      }
    } else {
      // Standalone image file (JPG, PNG, WebP)
      totalPages = 1;
      currentPage = 1;
      await initWorkerIfNeeded();
      isInitializing = false;

      if (onProgress) {
        onProgress('Optimizando imagen y mejorando contraste (300 DPI)...', 25);
      }

      const canvas = await prepareImageForOcr(file, options.enhanceContrast !== false);

      if (onProgress) {
        onProgress('Reconociendo texto con Tesseract OCR...', 50);
      }

      const { data } = await worker.recognize(canvas);
      const cleanText = sanitizeOcrText(data.text);

      pages.push({
        pageNumber: 1,
        text: cleanText,
        confidence: Math.round(data.confidence),
        method: 'ocr',
      });
    }
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }

  const fullText = pages
    .map((p) => (pages.length > 1 ? `--- PÁGINA ${p.pageNumber} ---\n\n${p.text}` : p.text))
    .join('\n\n');

  if (onProgress) {
    onProgress('¡Reconocimiento completado con éxito!', 100);
  }

  return { fullText, pages };
}

// 14. EXPORT OCR TEXT TO CLEAN SEARCHABLE PDF
export async function exportOcrResultToPdf(
  ocrResult: OcrResult
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 11;
  const lineHeight = 16;
  const margin = 40;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const maxLineWidth = pageWidth - margin * 2;

  for (const p of ocrResult.pages) {
    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let currentY = pageHeight - margin;

    if (ocrResult.pages.length > 1) {
      currentPage.drawText(`Página ${p.pageNumber}`, {
        x: margin,
        y: currentY,
        size: 9,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
      currentY -= 20;
    }

    const paragraphs = p.text.split('\n');
    for (const para of paragraphs) {
      const words = para.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);

        if (testWidth > maxLineWidth && currentLine) {
          if (currentY - lineHeight < margin) {
            currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
            currentY = pageHeight - margin;
          }
          currentPage.drawText(currentLine, {
            x: margin,
            y: currentY,
            size: fontSize,
            font,
            color: rgb(0.1, 0.1, 0.1),
          });
          currentY -= lineHeight;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        if (currentY - lineHeight < margin) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          currentY = pageHeight - margin;
        }
        currentPage.drawText(currentLine, {
          x: margin,
          y: currentY,
          size: fontSize,
          font,
          color: rgb(0.1, 0.1, 0.1),
        });
        currentY -= lineHeight;
      }

      currentY -= 8;
    }
  }

  return await pdfDoc.save();
}

/**
 * 14b. EXPORT OCR TEXT TO FULLY EDITABLE WORD (.DOCX) DOCUMENT
 */
export async function exportOcrResultToDocx(
  ocrResult: OcrResult,
  options: {
    addPageBreaks?: boolean;
    title?: string;
  } = {}
): Promise<Blob> {
  const { addPageBreaks = true, title } = options;
  const docxParagraphs: Paragraph[] = [];

  if (title) {
    docxParagraphs.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
      })
    );
  }

  const totalPages = ocrResult.pages.length;

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const page = ocrResult.pages[pageIdx];
    const pageText = page.text || '';

    // If multi-page and not the first page, add PageBreak
    if (pageIdx > 0 && addPageBreaks) {
      docxParagraphs.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      );
    }

    const rawLines = pageText.split('\n');

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i].trim();

      if (!line) {
        continue;
      }

      // Detect potential headings
      const isShort = line.length <= 60;
      const noEndPunct = !/[.:;,]$/.test(line);
      const isUpper = line === line.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(line);
      const isHeading1 = isShort && isUpper && line.length >= 4;
      const isHeading2 = isShort && noEndPunct && !isUpper && /^[A-ZÁÉÍÓÚÑ]/.test(line);

      // Detect bullet points
      const isBullet = /^[•\-*]\s+/.test(line);

      if (isHeading1) {
        docxParagraphs.push(
          new Paragraph({
            text: line,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 120 },
          })
        );
      } else if (isHeading2) {
        docxParagraphs.push(
          new Paragraph({
            text: line,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 180, after: 100 },
          })
        );
      } else if (isBullet) {
        const cleanBulletText = line.replace(/^[•\-*]\s+/, '');
        docxParagraphs.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({
                text: cleanBulletText,
                size: 22,
                font: 'Calibri',
              }),
            ],
            spacing: { after: 80, line: 276 },
          })
        );
      } else {
        docxParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line,
                size: 22,
                font: 'Calibri',
              }),
            ],
            spacing: { after: 120, line: 276 },
          })
        );
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        children:
          docxParagraphs.length > 0
            ? docxParagraphs
            : [new Paragraph({ text: 'Documento sin contenido de texto reconocido.' })],
      },
    ],
  });

  return await Packer.toBlob(doc);
}

// 15. CONVERT PDF TO WORD (.DOCX)
export interface PdfToWordOptions {
  mode: 'auto' | 'ocr' | 'standard';
  language?: string;
  detectHeadings?: boolean;
  addPageBreaks?: boolean;
}

export interface PdfToWordResult {
  docxBlob: Blob;
  pageCount: number;
  wordCount: number;
  paragraphCount: number;
}

export async function convertPdfToWord(
  pdfData: ArrayBuffer,
  options: PdfToWordOptions = { mode: 'auto', language: 'spa', detectHeadings: true, addPageBreaks: true },
  onProgress?: (statusText: string, percentage: number) => void
): Promise<PdfToWordResult> {
  const pdfJsDoc = await getPdfJsDocument(pdfData);
  const total = pdfJsDoc.numPages;
  const docxParagraphs: Paragraph[] = [];
  let totalWordCount = 0;
  let totalParagraphCount = 0;

  let ocrWorker: any = null;

  try {
    for (let pageNum = 1; pageNum <= total; pageNum++) {
      if (onProgress) {
        const pct = Math.round(((pageNum - 1) / total) * 90);
        onProgress(`Procesando página ${pageNum} de ${total}...`, pct);
      }

      const page = await pdfJsDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = textContent.items as Array<{
        str: string;
        transform: number[];
        width: number;
        height: number;
        fontName?: string;
      }>;

      const hasEnoughText = items.filter((it) => it.str.trim().length > 0).length >= 5;
      const shouldUseOcr = options.mode === 'ocr' || (options.mode === 'auto' && !hasEnoughText);

      if (shouldUseOcr) {
        if (onProgress) {
          onProgress(
            `Página ${pageNum} de ${total}: Aplicando Tesseract OCR a alta resolución (300 DPI)...`,
            Math.round(((pageNum - 0.5) / total) * 90)
          );
        }
        const baseVp = page.getViewport({ scale: 1.0 });
        const scale = Math.min(3.8, Math.max(2.2, 2400 / Math.max(baseVp.width, baseVp.height)));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport }).promise;
          preprocessCanvasForOcr(canvas);

          if (!ocrWorker) {
            const lang = options.language || 'spa';
            ocrWorker = await createWorker(lang);
            try {
              await ocrWorker.setParameters({
                preserve_interword_spaces: '1',
                tessedit_pageseg_mode: '3',
              });
            } catch (e) {
              console.warn(e);
            }
          }

          const { data } = await ocrWorker.recognize(canvas);
          const cleanText = sanitizeOcrText(data.text);
          const lines = cleanText.split('\n').map((l: string) => l.trim()).filter(Boolean);

        for (const line of lines) {
          const words = line.split(/\s+/).filter(Boolean);
          totalWordCount += words.length;
          totalParagraphCount++;

          docxParagraphs.push(
            new Paragraph({
              children: [new TextRun({ text: line, size: 24 })],
              spacing: { after: 120 },
            })
          );
        }
      }
    } else {
      const lines: { y: number; items: typeof items }[] = [];
      const sortedItems = [...items].sort((a, b) => b.transform[5] - a.transform[5]);

      for (const item of sortedItems) {
        if (!item.str.trim()) continue;
        const itemY = item.transform[5];
        const existingLine = lines.find((l) => Math.abs(l.y - itemY) <= 4);

        if (existingLine) {
          existingLine.items.push(item);
        } else {
          lines.push({ y: itemY, items: [item] });
        }
      }

      lines.sort((a, b) => b.y - a.y);

      const fontSizes: number[] = [];
      for (const line of lines) {
        for (const item of line.items) {
          const size = Math.abs(item.transform[0]) || 12;
          fontSizes.push(size);
        }
      }
      const avgFontSize = fontSizes.length > 0 ? fontSizes.reduce((a, b) => a + b, 0) / fontSizes.length : 12;

      for (const line of lines) {
        line.items.sort((a, b) => a.transform[4] - b.transform[4]);
        const lineText = line.items.map((it) => it.str).join(' ').trim();
        if (!lineText) continue;

        const words = lineText.split(/\s+/).filter(Boolean);
        totalWordCount += words.length;
        totalParagraphCount++;

        const maxLineFontSize = Math.max(...line.items.map((it) => Math.abs(it.transform[0]) || 12));
        const isHeading1 = options.detectHeadings && maxLineFontSize >= avgFontSize * 1.5 && lineText.length < 90;
        const isHeading2 = options.detectHeadings && maxLineFontSize >= avgFontSize * 1.25 && !isHeading1 && lineText.length < 110;

        if (isHeading1) {
          docxParagraphs.push(
            new Paragraph({
              text: lineText,
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 240, after: 120 },
            })
          );
        } else if (isHeading2) {
          docxParagraphs.push(
            new Paragraph({
              text: lineText,
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 180, after: 100 },
            })
          );
        } else {
          const isBullet = lineText.startsWith('•') || lineText.startsWith('-') || lineText.startsWith('*');
          const cleanText = isBullet ? lineText.replace(/^[•\-*]\s*/, '') : lineText;

          docxParagraphs.push(
            new Paragraph({
              bullet: isBullet ? { level: 0 } : undefined,
              children: [
                new TextRun({
                  text: cleanText,
                  size: Math.round(maxLineFontSize * 2),
                }),
              ],
              spacing: { after: 120 },
            })
          );
        }
      }
    }

    if (options.addPageBreaks && pageNum < total) {
      docxParagraphs.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      );
    }
    }
  } finally {
    if (ocrWorker) {
      await ocrWorker.terminate();
    }
  }

  if (onProgress) {
    onProgress('Empaquetando documento Word (.docx)...', 95);
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: docxParagraphs.length > 0 ? docxParagraphs : [new Paragraph({ text: 'Documento PDF sin texto' })],
      },
    ],
  });

  const docxBlob = await Packer.toBlob(doc);

  if (onProgress) {
    onProgress('¡Conversión completada con éxito!', 100);
  }

  return {
    docxBlob,
    pageCount: total,
    wordCount: totalWordCount,
    paragraphCount: totalParagraphCount,
  };
}

// 15. CROP PDF (Visual Vector Crop Tool)
export interface CropRectPercentages {
  x: number;      // 0 to 100 (% from left)
  y: number;      // 0 to 100 (% from top)
  width: number;  // 0 to 100 (% of width)
  height: number; // 0 to 100 (% of height)
}

export interface CropPdfOptions {
  crop: CropRectPercentages;
  targetPages: 'all' | number[];
}

export function detectPageContentMargins(canvas: HTMLCanvasElement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { x: 5, y: 5, width: 90, height: 90 };
  }

  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // We consider a pixel "blank/white" if RGB values are all > 242 or alpha < 30
  const isBlank = (idx: number) => {
    const a = data[idx + 3];
    if (a < 30) return true;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    return r > 242 && g > 242 && b > 242;
  };

  let top = 0;
  let bottom = height - 1;
  let left = 0;
  let right = width - 1;

  // Scan top
  topLoop: for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x += 2) {
      const idx = (y * width + x) * 4;
      if (!isBlank(idx)) {
        top = y;
        break topLoop;
      }
    }
  }

  // Scan bottom
  bottomLoop: for (let y = height - 1; y >= top; y--) {
    for (let x = 0; x < width; x += 2) {
      const idx = (y * width + x) * 4;
      if (!isBlank(idx)) {
        bottom = y;
        break bottomLoop;
      }
    }
  }

  // Scan left
  leftLoop: for (let x = 0; x < width; x++) {
    for (let y = top; y <= bottom; y += 2) {
      const idx = (y * width + x) * 4;
      if (!isBlank(idx)) {
        left = x;
        break leftLoop;
      }
    }
  }

  // Scan right
  rightLoop: for (let x = width - 1; x >= left; x--) {
    for (let y = top; y <= bottom; y += 2) {
      const idx = (y * width + x) * 4;
      if (!isBlank(idx)) {
        right = x;
        break rightLoop;
      }
    }
  }

  // Fallback if blank or unexpected
  if (right <= left || bottom <= top) {
    return { x: 5, y: 5, width: 90, height: 90 };
  }

  // Add 1.5% breathing room
  const padX = width * 0.015;
  const padY = height * 0.015;

  const cropX = Math.max(0, left - padX);
  const cropY = Math.max(0, top - padY);
  const cropRight = Math.min(width, right + padX);
  const cropBottom = Math.min(height, bottom + padY);

  return {
    x: Math.max(0, Math.round((cropX / width) * 1000) / 10),
    y: Math.max(0, Math.round((cropY / height) * 1000) / 10),
    width: Math.min(100, Math.round(((cropRight - cropX) / width) * 1000) / 10),
    height: Math.min(100, Math.round(((cropBottom - cropY) / height) * 1000) / 10),
  };
}

export async function cropPdf(
  pdfData: ArrayBuffer,
  options: CropPdfOptions,
  onProgress?: (message: string, percent: number) => void
): Promise<{
  data: Uint8Array;
  pageCount: number;
  croppedPagesCount: number;
}> {
  if (onProgress) onProgress('Cargando documento PDF...', 10);
  const [pdfJsDoc, pdfDoc] = await Promise.all([
    getPdfJsDocument(pdfData),
    PDFDocument.load(pdfData, { ignoreEncryption: true }),
  ]);
  const total = pdfDoc.getPageCount();

  const isAll = options.targetPages === 'all';
  const targetSet = new Set<number>(Array.isArray(options.targetPages) ? options.targetPages : []);

  let croppedPagesCount = 0;

  for (let i = 1; i <= total; i++) {
    if (onProgress) {
      const pct = 10 + Math.round((i / total) * 75);
      onProgress(`Recortando página ${i} de ${total}...`, pct);
    }

    if (!isAll && !targetSet.has(i)) {
      continue;
    }

    const pdfJsPage = await pdfJsDoc.getPage(i);
    const viewport = pdfJsPage.getViewport({ scale: 1.0 });

    const viewW = viewport.width;
    const viewH = viewport.height;

    // Convert percentage to pixel coordinates in viewport space
    const cropX = Math.max(0, (options.crop.x / 100) * viewW);
    const cropY = Math.max(0, (options.crop.y / 100) * viewH);
    const cropW = Math.min(viewW - cropX, (options.crop.width / 100) * viewW);
    const cropH = Math.min(viewH - cropY, (options.crop.height / 100) * viewH);

    // 4 corners of crop box in viewport space
    const corners = [
      viewport.convertToPdfPoint(cropX, cropY),
      viewport.convertToPdfPoint(cropX + cropW, cropY),
      viewport.convertToPdfPoint(cropX + cropW, cropY + cropH),
      viewport.convertToPdfPoint(cropX, cropY + cropH),
    ];

    const minX = Math.min(...corners.map((c) => c[0]));
    const maxX = Math.max(...corners.map((c) => c[0]));
    const minY = Math.min(...corners.map((c) => c[1]));
    const maxY = Math.max(...corners.map((c) => c[1]));

    const targetW = Math.max(1, maxX - minX);
    const targetH = Math.max(1, maxY - minY);

    const page = pdfDoc.getPage(i - 1);
    page.setCropBox(minX, minY, targetW, targetH);
    page.setMediaBox(minX, minY, targetW, targetH);

    croppedPagesCount++;
  }

  if (onProgress) onProgress('Guardando documento PDF recortado...', 90);
  const data = await pdfDoc.save();
  if (onProgress) onProgress('¡Listo!', 100);

  return {
    data,
    pageCount: total,
    croppedPagesCount,
  };
}

// 17. ANONYMIZE / REDACT PDF (PII SANITIZATION)
export interface RedactionItem {
  id: string;
  pageIndex: number; // 0-indexed
  x: number; // percentage 0 to 100 (from left)
  y: number; // percentage 0 to 100 (from top)
  width: number; // percentage 0 to 100
  height: number; // percentage 0 to 100
  category: 'dni' | 'email' | 'phone' | 'iban' | 'date' | 'custom' | 'manual';
  text: string;
  enabled: boolean;
}

export interface AnonymizeOptions {
  style: 'black' | 'white' | 'text';
  textLabel?: string;
  removeMetadata: boolean;
  flattenPdf: boolean;
}

/**
 * Automatically scans a PDF document for sensitive personal data (DNI/NIE/CIF, emails, phones, IBANs, dates, custom keywords)
 */
export async function scanPdfForSensitiveData(
  pdfData: ArrayBuffer,
  customKeywords: string[] = [],
  onProgress?: (progressText: string, percentage: number) => void
): Promise<RedactionItem[]> {
  const pdfJsDoc = await getPdfJsDocument(pdfData);
  const total = pdfJsDoc.numPages;
  const redactions: RedactionItem[] = [];

  const PATTERNS: { category: RedactionItem['category']; regex: RegExp; label: string }[] = [
    // Spanish DNI/NIE/CIF
    { category: 'dni', regex: /\b\d{8}[- ]?[A-HJ-NP-TV-Z]\b/gi, label: 'DNI' },
    { category: 'dni', regex: /\b[XYZxyz]\d{7}[- ]?[A-HJ-NP-TV-Z]\b/gi, label: 'NIE' },
    { category: 'dni', regex: /\b[ABCDEFGHJNPQRSUVWabcdefghjnpqrsuvw]\d{7}[0-9A-Za-z]\b/g, label: 'CIF' },
    // Email
    { category: 'email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, label: 'Email' },
    // Phone numbers (Spanish & international)
    { category: 'phone', regex: /\b(?:\+?34[- ]?)?[6789]\d{2}[- ]?\d{3}[- ]?\d{3}\b/g, label: 'Teléfono' },
    { category: 'phone', regex: /\b(?:\+?34[- ]?)?[6789]\d{1}[- ]?\d{2}[- ]?\d{2}[- ]?\d{2}\b/g, label: 'Teléfono' },
    // IBAN & Credit Cards
    { category: 'iban', regex: /\b[A-Z]{2}\d{2}[- ]?(?:\d{4}[- ]?){3,6}\b/g, label: 'IBAN' },
    { category: 'iban', regex: /\b(?:\d{4}[- ]?){3}\d{4}\b/g, label: 'Tarjeta' },
    // Dates
    { category: 'date', regex: /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, label: 'Fecha' },
  ];

  for (let pageNum = 1; pageNum <= total; pageNum++) {
    if (onProgress) {
      onProgress(`Analizando datos sensibles en página ${pageNum} de ${total}...`, Math.round((pageNum / total) * 100));
    }

    const page = await pdfJsDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const pWidth = viewport.width;
    const pHeight = viewport.height;
    const textContent = await page.getTextContent();
    const items = textContent.items as Array<{
      str: string;
      transform: number[];
      width: number;
      height: number;
    }>;

    const validItems = items.filter((it) => it.str && it.str.trim().length > 0);

    for (const it of validItems) {
      const itX = it.transform[4];
      const itY = it.transform[5];
      const itW = it.width;
      const itH = Math.max(10, Math.abs(it.transform[3]) || Math.abs(it.transform[0]) || 12);

      // Check standard regex patterns
      for (const p of PATTERNS) {
        p.regex.lastIndex = 0;
        let match;
        while ((match = p.regex.exec(it.str)) !== null) {
          const matchStr = match[0];
          const matchStart = match.index;
          const matchLen = matchStr.length;

          const charWidth = itW / Math.max(1, it.str.length);
          const subX = itX + matchStart * charWidth;
          const subW = Math.max(10, matchLen * charWidth);

          const leftPct = Math.max(0, ((subX - 2) / pWidth) * 100);
          const topPct = Math.max(0, ((pHeight - itY - itH * 0.95 - 2) / pHeight) * 100);
          const widthPct = Math.min(100, ((subW + 4) / pWidth) * 100);
          const heightPct = Math.min(100, ((itH * 1.25 + 4) / pHeight) * 100);

          redactions.push({
            id: `redact-${pageNum}-${redactions.length}-${Math.random().toString(36).substring(2, 7)}`,
            pageIndex: pageNum - 1,
            x: Math.round(leftPct * 100) / 100,
            y: Math.round(topPct * 100) / 100,
            width: Math.round(widthPct * 100) / 100,
            height: Math.round(heightPct * 100) / 100,
            category: p.category,
            text: matchStr,
            enabled: true,
          });
        }
      }

      // Check custom user keywords
      for (const kw of customKeywords) {
        if (!kw || !kw.trim()) continue;
        const cleanKw = kw.trim();
        const kwRegex = new RegExp(cleanKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        let match;
        while ((match = kwRegex.exec(it.str)) !== null) {
          const matchStr = match[0];
          const matchStart = match.index;
          const matchLen = matchStr.length;

          const charWidth = itW / Math.max(1, it.str.length);
          const subX = itX + matchStart * charWidth;
          const subW = Math.max(10, matchLen * charWidth);

          const leftPct = Math.max(0, ((subX - 2) / pWidth) * 100);
          const topPct = Math.max(0, ((pHeight - itY - itH * 0.95 - 2) / pHeight) * 100);
          const widthPct = Math.min(100, ((subW + 4) / pWidth) * 100);
          const heightPct = Math.min(100, ((itH * 1.25 + 4) / pHeight) * 100);

          redactions.push({
            id: `redact-${pageNum}-${redactions.length}-${Math.random().toString(36).substring(2, 7)}`,
            pageIndex: pageNum - 1,
            x: Math.round(leftPct * 100) / 100,
            y: Math.round(topPct * 100) / 100,
            width: Math.round(widthPct * 100) / 100,
            height: Math.round(heightPct * 100) / 100,
            category: 'custom',
            text: matchStr,
            enabled: true,
          });
        }
      }
    }
  }

  return redactions;
}

/**
 * Applies permanent anonymization/redactions and metadata sanitization to PDF
 */
export async function applyAnonymizationToPdf(
  pdfData: ArrayBuffer,
  redactions: RedactionItem[],
  options: AnonymizeOptions = { style: 'black', textLabel: '[CENSURADO]', removeMetadata: true, flattenPdf: true },
  onProgress?: (progressText: string, percentage: number) => void
): Promise<Uint8Array> {
  const activeRedactions = redactions.filter((r) => r.enabled);

  if (options.flattenPdf) {
    // 1. Permanent Image Flattening: physically obliterates pixels beneath redactions
    const pdfJsDoc = await getPdfJsDocument(pdfData);
    const total = pdfJsDoc.numPages;
    const newPdfDoc = await PDFDocument.create();

    for (let pageNum = 1; pageNum <= total; pageNum++) {
      if (onProgress) {
        onProgress(`Anonimizando y aplanando página ${pageNum} de ${total}...`, Math.round((pageNum / total) * 90));
      }

      const page = await pdfJsDoc.getPage(pageNum);
      const baseVp = page.getViewport({ scale: 1.0 });
      // Crisp 2.0 - 2.5 scale for sharp typography & print quality
      const scale = Math.min(2.8, Math.max(2.0, 2000 / Math.max(baseVp.width, baseVp.height)));
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      // Draw active redactions on this page directly onto canvas
      const pageRedactions = activeRedactions.filter((r) => r.pageIndex === pageNum - 1);
      for (const r of pageRedactions) {
        const px = (r.x / 100) * canvas.width;
        const py = (r.y / 100) * canvas.height;
        const pw = (r.width / 100) * canvas.width;
        const ph = (r.height / 100) * canvas.height;

        if (options.style === 'white') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(px, py, pw, ph);
        } else if (options.style === 'text') {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(px, py, pw, ph);
          ctx.fillStyle = '#ffffff';
          const fontSize = Math.max(10, Math.round(ph * 0.65));
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(options.textLabel || '[CENSURADO]', px + pw / 2, py + ph / 2);
        } else {
          ctx.fillStyle = '#000000';
          ctx.fillRect(px, py, pw, ph);
        }
      }

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) continue;
      const imgBuffer = await blob.arrayBuffer();
      const embeddedImg = await newPdfDoc.embedJpg(imgBuffer);

      const newPage = newPdfDoc.addPage([baseVp.width, baseVp.height]);
      newPage.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: baseVp.width,
        height: baseVp.height,
      });
    }

    if (options.removeMetadata) {
      newPdfDoc.setTitle('');
      newPdfDoc.setAuthor('');
      newPdfDoc.setSubject('');
      newPdfDoc.setKeywords([]);
      newPdfDoc.setProducer('PDFMaster Anonymizer');
      newPdfDoc.setCreator('PDFMaster');
      newPdfDoc.setCreationDate(new Date(0));
      newPdfDoc.setModificationDate(new Date(0));
    }

    if (onProgress) {
      onProgress('Empaquetando documento protegido...', 98);
    }

    return await newPdfDoc.save();
  } else {
    // 2. Vector Redaction
    const pdfDoc = await PDFDocument.load(pdfData, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    let fontBold: any = null;
    if (options.style === 'text') {
      fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }

    for (const r of activeRedactions) {
      if (r.pageIndex < 0 || r.pageIndex >= pages.length) continue;
      const page = pages[r.pageIndex];
      const { width: pWidth, height: pHeight } = page.getSize();

      const pdfX = (r.x / 100) * pWidth;
      const pdfY = pHeight - (r.y / 100) * pHeight;
      const pdfW = (r.width / 100) * pWidth;
      const pdfH = (r.height / 100) * pHeight;

      if (options.style === 'white') {
        page.drawRectangle({
          x: pdfX,
          y: pdfY - pdfH,
          width: pdfW,
          height: pdfH,
          color: rgb(1, 1, 1),
        });
      } else if (options.style === 'text' && fontBold) {
        page.drawRectangle({
          x: pdfX,
          y: pdfY - pdfH,
          width: pdfW,
          height: pdfH,
          color: rgb(0.06, 0.09, 0.16),
        });
        const label = options.textLabel || '[CENSURADO]';
        const fontSize = Math.max(7, Math.min(11, pdfH * 0.65));
        const textWidth = fontBold.widthOfTextAtSize(label, fontSize);
        const textX = Math.max(pdfX + 2, pdfX + (pdfW - textWidth) / 2);
        const textY = pdfY - pdfH + (pdfH - fontSize) / 2 + 1;
        page.drawText(label, {
          x: textX,
          y: textY,
          size: fontSize,
          font: fontBold,
          color: rgb(1, 1, 1),
        });
      } else {
        page.drawRectangle({
          x: pdfX,
          y: pdfY - pdfH,
          width: pdfW,
          height: pdfH,
          color: rgb(0, 0, 0),
        });
      }
    }

    if (options.removeMetadata) {
      pdfDoc.setTitle('');
      pdfDoc.setAuthor('');
      pdfDoc.setSubject('');
      pdfDoc.setKeywords([]);
      pdfDoc.setProducer('PDFMaster Anonymizer');
      pdfDoc.setCreator('PDFMaster');
      pdfDoc.setCreationDate(new Date(0));
      pdfDoc.setModificationDate(new Date(0));
    }

    if (onProgress) {
      onProgress('Empaquetando documento protegido...', 98);
    }

    return await pdfDoc.save();
  }
}

