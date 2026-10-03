export type ToolId =
  | 'merge'
  | 'split'
  | 'organize'
  | 'edit'
  | 'compress'
  | 'pdf-to-img'
  | 'img-to-pdf'
  | 'pdf-to-word'
  | 'watermark'
  | 'protect'
  | 'ocr'
  | 'page-number'
  | 'unlock'
  | 'compare';

export type ToolCategory = 'organize' | 'optimize' | 'convert' | 'edit' | 'security';

export interface ToolDef {
  id: ToolId;
  name: string;
  shortDesc: string;
  fullDesc: string;
  category: ToolCategory;
  badge?: string;
  icon: string;
  color: string;
  accentBg: string;
}

export interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  arrayBuffer: ArrayBuffer;
  pageCount?: number;
  previewUrl?: string;
}

export interface PageInfo {
  pageNumber: number;
  rotation: number;
  thumbnailUrl: string;
  isDeleted?: boolean;
}

export type AnnotationType = 'text' | 'draw' | 'image' | 'rect';

export interface BaseAnnotation {
  id: string;
  pageIndex: number; // 0-indexed
  type: AnnotationType;
  x: number; // percentage (0 to 100) or pt
  y: number;
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  text: string;
  fontSize: number;
  color: string;
  isBold?: boolean;
}

export interface DrawAnnotation extends BaseAnnotation {
  type: 'draw';
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
}

export interface ImageAnnotation extends BaseAnnotation {
  type: 'image';
  dataUrl: string;
  width: number;
  height: number;
}

export interface RectAnnotation extends BaseAnnotation {
  type: 'rect';
  width: number;
  height: number;
  color: string;
  fillColor?: string;
  strokeWidth: number;
}

export type Annotation = TextAnnotation | DrawAnnotation | ImageAnnotation | RectAnnotation;
