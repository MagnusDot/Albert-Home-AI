import chalk from 'chalk';
import record from 'node-record-lpcm16';
import { RecordingOptions } from '../types/index.js';

export class RecordingManager {
  private rec: any = null;
  private isRecording = false;

  startRecording(options: RecordingOptions, onData: (chunk: Buffer) => void, onEnd: () => void, onError: (error: Error) => void): void {
    if (this.isRecording) {
      console.log(chalk.yellow('[RecordingManager] Ignoré: déjà en cours'));
      return;
    }

    this.rec = record.record({
      sampleRateHertz: options.sampleRateHertz,
      threshold: options.threshold,
      verbose: false,
      recordProgram: 'rec',
      silence: options.silence,
      endOnSilence: options.endOnSilence
    });

    this.isRecording = true;

    this.rec.stream()
      .on('data', onData)
      .on('end', () => {
        this.isRecording = false;
        console.log(chalk.blue('[RecordingManager] ⏹️ Fin du flux micro (event end)'));
        onEnd();
      })
      .on('error', (error: Error) => {
        this.isRecording = false;
        console.log(chalk.red('[RecordingManager] ❌ Erreur micro :'), error);
        onError(error);
      });
  }

  stopRecording(): void {
    if (this.rec && this.isRecording) {
      console.log(chalk.blue('[RecordingManager] ⏹️ stopRecording appelé'));
      this.rec.stop();
      this.isRecording = false;
    } else {
      console.log(chalk.dim('[RecordingManager] stopRecording ignoré (déjà arrêté)'));
    }
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }
} 