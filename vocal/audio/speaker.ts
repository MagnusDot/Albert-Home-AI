import chalk from 'chalk';
import Speaker from 'speaker';

export class SpeakerManager {
  private currentSpeaker: Speaker | null = null;
  private isPlaying: boolean = false;
  private onAudioFinished?: () => void;
  private audioBuffer: Buffer[] = [];
  private minBufferSize: number = 48000;
  private isStopping: boolean = false;
  private isEnding: boolean = false;
  private hasCalledFinished: boolean = false;

  setOnAudioFinished(callback: () => void): void {
    this.onAudioFinished = callback;
  }

  playAudio(audioData: ArrayBuffer): void {
    if (this.isStopping) {
      return;
    }

    if (!this.currentSpeaker || this.currentSpeaker.destroyed) {
      console.log(chalk.blue('🔊 Création d\'un nouveau speaker'));
      this.isPlaying = true;
      this.isStopping = false;
      this.isEnding = false;
      this.hasCalledFinished = false;
      this.audioBuffer = [];
      this.currentSpeaker = new Speaker({
        channels: 1,
        bitDepth: 16,
        sampleRate: 24000,
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
        if (this.isStopping && this.audioBuffer.length === 0 && !this.isEnding) {
          setTimeout(() => {
            if (this.currentSpeaker && !this.currentSpeaker.destroyed && !this.isEnding) {
              this.isEnding = true;
              this.currentSpeaker.end();
            }
          }, 200);
        }
      });
    }

    const audioBuffer = Buffer.from(audioData);
    this.audioBuffer.push(audioBuffer);

    const totalBufferSize = this.audioBuffer.reduce((sum, buf) => sum + buf.length, 0);

    if (totalBufferSize >= this.minBufferSize || !this.currentSpeaker.writable) {
      this.flushBuffer();
    }
  }

  private flushBuffer(): void {
    if (!this.currentSpeaker || this.currentSpeaker.destroyed || this.audioBuffer.length === 0) {
      if (this.isStopping && this.audioBuffer.length === 0 && !this.isEnding) {
        setTimeout(() => {
          if (this.currentSpeaker && !this.currentSpeaker.destroyed && !this.isEnding) {
            this.isEnding = true;
            this.currentSpeaker.end();
          }
        }, 200);
      }
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

      if (this.isStopping && this.audioBuffer.length === 0 && !this.isEnding) {
        setTimeout(() => {
          if (this.currentSpeaker && !this.currentSpeaker.destroyed && !this.isEnding) {
            this.isEnding = true;
            this.currentSpeaker.end();
          }
        }, 200);
      }
    } catch (error) {
      console.error(chalk.red('❌ Erreur écriture audio:'), error);
      this.stop();
    }
  }

  stop(): void {
    if (this.currentSpeaker && !this.currentSpeaker.destroyed) {
      this.isStopping = true;
      this.flushBuffer();
      if (this.audioBuffer.length === 0 && !this.isEnding) {
        setTimeout(() => {
          if (this.currentSpeaker && !this.currentSpeaker.destroyed && !this.isEnding) {
            this.isEnding = true;
            this.currentSpeaker.end();
          }
        }, 200);
      }
    } else {
      this.isPlaying = false;
      this.isStopping = false;
      this.isEnding = false;
      this.hasCalledFinished = false;
      this.currentSpeaker = null;
      this.audioBuffer = [];
    }
  }

  isActive(): boolean {
    return this.isPlaying;
  }
}

