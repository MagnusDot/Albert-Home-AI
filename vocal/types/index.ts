export interface AudioEvent {
  data?: ArrayBuffer;
}

export interface SessionCallbacks {
  onAgentStart?: () => void;
  onAgentEnd?: () => void;
  onAudioStart?: () => void;
  onAudioStop?: () => void;
  onResponseCreated?: () => void;
}

export interface MicrophoneConfig {
  sampleRateHertz: number;
  threshold: number;
  silence: string;
}

export interface SpeakerConfig {
  channels: number;
  bitDepth: number;
  sampleRate: number;
}

