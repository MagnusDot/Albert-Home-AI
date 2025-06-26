import { pipeline } from '@xenova/transformers';
import { WhisperModel } from '../types/index.js';
import { AudioUtils } from '../utils/audio-utils.js';

export class WhisperService {
  private transcriber: any = null;
  private modelName: WhisperModel;
  private isInitialized = false;

  constructor(modelName: WhisperModel = 'base') {
    this.modelName = modelName;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.transcriber = await pipeline(
        'automatic-speech-recognition', 
        `Xenova/whisper-${this.modelName}`
      );

      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Erreur initialisation Whisper: ${error.message}`);
    }
  }

  async transcribe(audioBuffer: Buffer): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const audioData = AudioUtils.convertBufferToFloat32(audioBuffer);
      
      const result = await this.transcriber(audioData, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: false,
        language: 'french',
        task: 'transcribe'
      });

      return result.text || '';
    } catch (error) {
      throw new Error(`Erreur transcription: ${error.message}`);
    }
  }

  async transcribeWithTimeout(audioBuffer: Buffer, timeoutMs: number = 10000): Promise<string> {
    const transcriptionPromise = this.transcribe(audioBuffer);
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Transcription timeout')), timeoutMs)
    );
    
    return await Promise.race([transcriptionPromise, timeoutPromise]);
  }

  getModelInfo(): { name: string; initialized: boolean } {
    return {
      name: this.modelName,
      initialized: this.isInitialized
    };
  }
} 