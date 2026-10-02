import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { pdfjsLib } from './pdfWorker';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt-lite';
import JSZip from 'jszip';
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
