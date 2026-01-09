
export interface MediaFile {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
}

export interface VideoState {
  images: MediaFile[];
  audio: MediaFile | null;
  duration: number; // in seconds
  status: 'idle' | 'processing' | 'exporting' | 'completed' | 'error';
  progress: number;
}

export interface TransitionType {
  id: string;
  name: string;
}

export const TRANSITIONS: TransitionType[] = [
  { id: 'fade', name: 'Cross Fade' },
  { id: 'slide', name: 'Slide Right' },
  { id: 'zoom', name: 'Zoom In' },
  { id: 'none', name: 'None' }
];
