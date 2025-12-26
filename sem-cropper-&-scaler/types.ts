export interface ScaleBarSettings {
  show: boolean;
  lengthValue: number; // e.g., 10
  lengthUnit: string; // e.g., 'µm'
  barHeight: number; // pixels
  fontSize: number;
  fontColor: string;
  barColor: string;
  position: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  overlayPadding: number;
}

export interface CalibrationData {
  pixels: number; // Distance in pixels drawn by user
  knownDistance: number; // The real world distance those pixels represent
  unit: string; // e.g., 'µm'
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export enum AppState {
  UPLOAD = 'UPLOAD',
  CALIBRATE = 'CALIBRATE',
  EDIT = 'EDIT',
}

export interface SemAnalysisResult {
  suggestedCropY: number;
  detectedScaleText?: string;
}