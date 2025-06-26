import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SoundPlayer {
  private static instance: SoundPlayer;

  private constructor() {}

  static getInstance(): SoundPlayer {
    if (!SoundPlayer.instance) {
      SoundPlayer.instance = new SoundPlayer();
    }
    return SoundPlayer.instance;
  }

  async playWakeWordSound(): Promise<void> {
    try {
      const { spawn } = await import('child_process');
      const soundPath = path.join(__dirname, '..', 'audio', 'wakeup.mp3');
      
      if (process.platform === 'darwin') {
        const afplay = spawn('afplay', [soundPath], {
          stdio: 'ignore',
          detached: true
        });
        
        setTimeout(() => {
          try {
            afplay.kill();
          } catch (e) {
          }
        }, 1000);
        
      } else if (process.platform === 'linux') {
        const { exec } = await import('child_process');
        exec(`mpv --no-video --volume=50 "${soundPath}"`, (error) => {
          if (error) {
            exec(`mpg123 "${soundPath}"`, () => {});
          }
        });
      } else {
        const { exec } = await import('child_process');
        exec(`powershell -c "Add-Type -AssemblyName System.Windows.Forms; [System.Media.SystemSounds]::Asterisk.Play()"`, () => {});
      }
      
    } catch (error) {
      console.log('🔊 Erreur son de notification:', error.message);
    }
  }
} 