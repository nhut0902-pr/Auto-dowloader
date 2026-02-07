
export interface PdfPage {
  index: number;
  dataUrl: string;
  width: number;
  height: number;
  selected: boolean;
  insight?: string;
  isAnalyzing?: boolean;
}

export enum OutputFormat {
  PNG = 'image/png',
  JPG = 'image/jpeg'
}

export interface AppState {
  isProcessing: boolean;
  pages: PdfPage[];
  fileName: string;
  format: OutputFormat;
  quality: number;
}
