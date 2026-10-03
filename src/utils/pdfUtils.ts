import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { pdfjsLib } from './pdfWorker';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt-lite';
import JSZip from 'jszip';
import Tesseract from 'tesseract.js';
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
  }[];
}

export async function performOcr(
  file: File,
  language: string = 'spa',
  onProgress?: (progressText: string, percentage: number) => void
): Promise<OcrResult> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const pages: { pageNumber: number; text: string; confidence: number }[] = [];

  if (isPdf) {
    const buffer = await file.arrayBuffer();
    const pdfJsDoc = await getPdfJsDocument(buffer);
    const total = pdfJsDoc.numPages;

    for (let i = 1; i <= total; i++) {
      if (onProgress) {
        onProgress(`Renderizando página ${i} de ${total}...`, Math.round(((i - 1) / total) * 100));
      }

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

      const pageBaseProgress = ((i - 1) / total) * 100;
      const pageSlice = 100 / total;

      const { data } = await Tesseract.recognize(canvas, language, {
        logger: (m) => {
          if (m.status === 'recognizing text' && onProgress) {
            const currentTotalPct = Math.min(
              99,
              Math.round(pageBaseProgress + m.progress * pageSlice)
            );
            onProgress(
              `Página ${i}/${total}: Reconociendo texto (${Math.round(m.progress * 100)}%)...`,
              currentTotalPct
            );
          }
        },
      });

      pages.push({
        pageNumber: i,
        text: data.text.trim(),
        confidence: Math.round(data.confidence),
      });
    }
  } else {
    if (onProgress) {
      onProgress('Cargando imagen e inicializando motor OCR...', 10);
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const { data } = await Tesseract.recognize(dataUrl, language, {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(
            `Reconociendo caracteres (${Math.round(m.progress * 100)}%)...`,
            Math.round(m.progress * 100)
          );
        } else if (onProgress) {
          onProgress(m.status, 20);
        }
      },
    });

    pages.push({
      pageNumber: 1,
      text: data.text.trim(),
      confidence: Math.round(data.confidence),
    });
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
          `Página ${pageNum} de ${total}: Aplicando OCR para texto escaneado...`,
          Math.round(((pageNum - 0.5) / total) * 90)
        );
      }
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;

        const lang = options.language || 'spa';
        const { data } = await Tesseract.recognize(canvas, lang);
        const lines = data.text.split('\n').map((l) => l.trim()).filter(Boolean);

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
