import chalk from 'chalk';
import Speaker from 'speaker';
import { AUDIO_CONFIG } from '../config/constants.js';

export class SpeakerManager {
  private currentSpeaker: Speaker | null = null;
  private isPlaying: boolean = false;
  private onAudioFinished?: () => void;
  private audioBuffer: Buffer[] = [];
  private isStopping: boolean = false;
  private isEnding: boolean = false;
  private hasCalledFinished: boolean = false;
  private endTimeout: NodeJS.Timeout | null = null;

  setOnAudioFinished(callback: () => void): void {
    this.onAudioFinished = callback;
  }

  playAudio(audioData: ArrayBuffer): void {
    if (this.isStopping) {
      return;
    }

    if (!this.currentSpeaker || this.currentSpeaker.destroyed) {
      this.resetState();
      console.log(chalk.blue('🔊 Création d\'un nouveau speaker'));
      this.isPlaying = true;
      this.audioBuffer = [];
      this.currentSpeaker = new Speaker({
        channels: AUDIO_CONFIG.CHANNELS,
        bitDepth: AUDIO_CONFIG.BIT_DEPTH,
        sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
      });
      
      this.currentSpeaker.on('error', (err: Error) => {
        console.error(chalk.red('❌ Erreur speaker:'), err);
        this.stop();
      });
      
      this.currentSpeaker.on('close', () => {
        if (this.hasCalledFinished) {
          return;
        }
        this.hasCalledFinished = true;
        console.log(chalk.dim('🔇 Speaker fermé - Audio terminé'));
        this.isPlaying = false;
        this.isStopping = false;
        this.isEnding = false;
        this.currentSpeaker = null;
        this.audioBuffer = [];
        if (this.onAudioFinished) {
          this.onAudioFinished();
        }
      });

      this.currentSpeaker.on('drain', () => {
        this.flushBuffer();
        this.scheduleEndIfNeeded();
      });
    }

    const audioBuffer = Buffer.from(audioData);
    this.audioBuffer.push(audioBuffer);

    const totalBufferSize = this.getTotalBufferSize();
    if (totalBufferSize >= AUDIO_CONFIG.MIN_BUFFER_SIZE || !this.currentSpeaker.writable) {
      this.flushBuffer();
    }
  }

  private flushBuffer(): void {
    if (!this.currentSpeaker || this.currentSpeaker.destroyed || this.audioBuffer.length === 0) {
      this.scheduleEndIfNeeded();
      return;
    }

    try {
      while (this.audioBuffer.length > 0 && this.currentSpeaker.writable) {
        const chunk = this.audioBuffer.shift();
        if (chunk) {
          const canContinue = this.currentSpeaker.write(chunk);
          if (!canContinue) {
            break;
          }
        }
      }

      this.scheduleEndIfNeeded();
    } catch (error) {
      console.error(chalk.red('❌ Erreur écriture audio:'), error);
      this.stop();
    }
  }

  private scheduleEndIfNeeded(): void {
    if (this.isStopping && this.audioBuffer.length === 0 && !this.isEnding && !this.endTimeout) {
      this.endTimeout = setTimeout(() => {
        this.endTimeout = null;
        if (this.currentSpeaker && !this.currentSpeaker.destroyed && !this.isEnding) {
          this.isEnding = true;
          this.currentSpeaker.end();
        }
      }, AUDIO_CONFIG.STOP_DELAY_MS);
    }
  }

  private getTotalBufferSize(): number {
    return this.audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
  }

  private resetState(): void {
    this.isStopping = false;
    this.isEnding = false;
    this.hasCalledFinished = false;
    if (this.endTimeout) {
      clearTimeout(this.endTimeout);
      this.endTimeout = null;
    }
  }

  stop(): void {
    if (this.currentSpeaker && !this.currentSpeaker.destroyed) {
      this.isStopping = true;
      this.flushBuffer();
      this.scheduleEndIfNeeded();
    } else {
      this.isPlaying = false;
      this.resetState();
      this.currentSpeaker = null;
      this.audioBuffer = [];
    }
  }

  isActive(): boolean {
    return this.isPlaying;
  }
}

