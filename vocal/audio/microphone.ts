import chalk from 'chalk';
import { MICROPHONE_CONFIG } from '../config/constants.js';

type Recorder = {
  record: (options: {
    sampleRateHertz: number;
    threshold: number;
    verbose: boolean;
    recordProgram: string;
    silence: string;
  }) => {
    stream: () => NodeJS.ReadableStream & {
      on: (event: 'data' | 'error', handler: (data: Buffer | Error) => void) => void;
    };
    stop: () => void;
  };
};

export class MicrophoneManager {
  private recorder: ReturnType<Recorder['record']> | null = null;
  private isEnabled: boolean = false;
  private onAudioData?: (audio: ArrayBuffer) => void;

  async start(onAudioData: (audio: ArrayBuffer) => void): Promise<void> {
    this.onAudioData = onAudioData;
    
    try {
      const record = (await import('node-record-lpcm16')).default as Recorder;
      this.recorder = record.record({
        sampleRateHertz: MICROPHONE_CONFIG.SAMPLE_RATE_HERTZ,
        threshold: MICROPHONE_CONFIG.THRESHOLD,
        verbose: false,
        recordProgram: 'rec',
        silence: MICROPHONE_CONFIG.SILENCE,
      });

      this.recorder.stream()
        .on('data', (chunk: Buffer) => {
          if (this.isEnabled && this.onAudioData) {
            this.onAudioData(this.bufferToArrayBuffer(chunk));
          }
        })
        .on('error', (err: Error) => {
          console.error(chalk.red('❌ Erreur enregistrement:'), err);
        });

      this.isEnabled = true;
      console.log(chalk.green('🎤 Microphone activé'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  Capture audio non disponible (SoX requis)'));
      throw error;
    }
  }

  stop(): void {
    this.isEnabled = false;
    if (this.recorder) {
      this.recorder.stop();
      this.recorder = null;
    }
    console.log(chalk.dim('🎤 Microphone arrêté'));
  }

  enable(): void {
    if (!this.isEnabled) {
      this.isEnabled = true;
      console.log(chalk.dim('🎤 Microphone activé'));
    }
  }

  disable(): void {
    if (this.isEnabled) {
      this.isEnabled = false;
      console.log(chalk.dim('🎤 Microphone désactivé'));
    }
  }

  isActive(): boolean {
    return this.isEnabled && this.recorder !== null;
  }

  private bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
    const arrayBuffer = new ArrayBuffer(buffer.length);
    const view = new Uint8Array(arrayBuffer);
    view.set(buffer);
    return arrayBuffer;
  }
}

