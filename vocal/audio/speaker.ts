import chalk from 'chalk';
import Speaker from 'speaker';

export class SpeakerManager {
  private currentSpeaker: Speaker | null = null;
  private isPlaying: boolean = false;
  private onAudioFinished?: () => void;

  setOnAudioFinished(callback: () => void): void {
    this.onAudioFinished = callback;
  }

  playAudio(audioData: ArrayBuffer): void {
    if (!this.currentSpeaker || this.currentSpeaker.destroyed) {
      console.log(chalk.blue('🔊 Création d\'un nouveau speaker'));
      this.isPlaying = true;
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
        console.log(chalk.dim('🔇 Speaker fermé - Audio terminé'));
        this.isPlaying = false;
        this.currentSpeaker = null;
        if (this.onAudioFinished) {
          this.onAudioFinished();
        }
      });
    }

    if (this.currentSpeaker && !this.currentSpeaker.destroyed) {
      const audioBuffer = Buffer.from(audioData);
      try {
        this.currentSpeaker.write(audioBuffer);
      } catch (error) {
        console.error(chalk.red('❌ Erreur écriture audio:'), error);
        this.stop();
      }
    }
  }

  stop(): void {
    if (this.currentSpeaker && !this.currentSpeaker.destroyed) {
      this.currentSpeaker.end();
    } else {
      this.isPlaying = false;
      this.currentSpeaker = null;
    }
  }

  isActive(): boolean {
    return this.isPlaying;
  }
}

