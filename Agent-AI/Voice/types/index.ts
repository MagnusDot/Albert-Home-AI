export interface VoiceConfig {
  api_url: string;
  bearer_token?: string;
}

export interface ThreadInfo {
  thread_id: string;
  lastUsed: number;
}

export interface DetectionStats {
  totalDetections: number;
  avgLatency: number;
  maxLatency: number;
  minLatency: number;
  transcriptionTime: number;
  falsePositives: number;
}

export interface AudioLevel {
  level: number;
  percentage: number;
  bar: string;
}

export interface TranscriptionResult {
  text: string;
  confidence?: number;
  language?: string;
}

export interface AlbertResponse {
  content?: string;
  response?: string;
  message?: string;
  conversation_id?: string;
}

export interface WakeWordDetection {
  detected: boolean;
  keywordIndex?: number;
  detectionTime: number;
  method: 'porcupine' | 'whisper';
}

export type WhisperModel = 'tiny' | 'base' | 'small' | 'medium' | 'large';

export interface RecordingOptions {
  sampleRateHertz: number;
  threshold: number;
  silence: string;
  endOnSilence: boolean;
} 