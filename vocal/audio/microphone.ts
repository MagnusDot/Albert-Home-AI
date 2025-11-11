import chalk from 'chalk';

export class MicrophoneManager {
  private recorder: any = null;
  private isEnabled: boolean = false;
  private onAudioData?: (audio: ArrayBuffer) => void;

  async start(onAudioData: (audio: ArrayBuffer) => void): Promise<void> {
    this.onAudioData = onAudioData;
    
    try {
      const record = (await import('node-record-lpcm16')).default;
      this.recorder = record.record({
        sampleRateHertz: 24000,
        threshold: 0.8,
        verbose: false,
        recordProgram: 'rec',
        silence: '2.0',
      });

      this.recorder.stream()
        .on('data', (chunk: Buffer) => {
          if (this.isEnabled && this.onAudioData) {
            // Convertir Buffer en ArrayBuffer
            const arrayBuffer = new ArrayBuffer(chunk.length);
            const view = new Uint8Array(arrayBuffer);
            view.set(chunk);
            this.onAudioData(arrayBuffer);
          }
        })
        .on('error', (err: Error) => {
          console.error(chalk.red('❌ Erreur enregistrement:'), err);
        });

      this.isEnabled = true;
      console.log(chalk.green('🎤 Microphone activé'));
    } catch (error: any) {
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
    this.isEnabled = true;
    console.log(chalk.dim('🎤 Microphone activé'));
  }

  disable(): void {
    this.isEnabled = false;
    console.log(chalk.dim('🎤 Microphone désactivé'));
  }

  isActive(): boolean {
    return this.isEnabled && this.recorder !== null;
  }
}

