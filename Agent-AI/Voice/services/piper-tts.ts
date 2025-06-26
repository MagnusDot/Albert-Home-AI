import chalk from 'chalk';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface PiperTTSConfig {
  modelPath?: string;
  configPath?: string;
  piperPath?: string;
  voice?: string;
  speed?: number;
  outputFormat?: 'wav' | 'mp3';
  sampleRate?: number;
}

export class PiperTTSService {
  private static instance: PiperTTSService;
  private config: PiperTTSConfig;
  private isInitialized = false;
  private modelsDir: string;
  private tempDir: string;

  private constructor() {
    this.config = {
      voice: 'fr_FR-mls-medium',
      speed: 1.0,
      outputFormat: 'wav',
      sampleRate: 22050
    };
    this.modelsDir = path.join(__dirname, '..', 'models');
    this.tempDir = path.join(__dirname, '..', 'audio', 'temp');
  }

  static getInstance(): PiperTTSService {
    if (!PiperTTSService.instance) {
      PiperTTSService.instance = new PiperTTSService();
    }
    return PiperTTSService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.ensureDirectories();
      
      await this.checkPiperInstallation();
      
      await this.ensureFrenchModel();
      
      this.isInitialized = true;
      console.log(chalk.green('✅ Piper TTS initialisé'));
    } catch (error) {
      console.error(chalk.red('❌ Erreur initialisation Piper TTS:'), error);
      throw error;
    }
  }

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.modelsDir, { recursive: true });
    await fs.mkdir(this.tempDir, { recursive: true });
  }

  private async checkPiperInstallation(): Promise<void> {
    return new Promise((resolve, reject) => {
      const venvPiperPath = '/Volumes/code/Git/Albert-Home-AI/Agent-AI/Voice/.venv/bin/piper';
      
      const piper = spawn(venvPiperPath, ['--help'], { stdio: 'pipe' });
      
      piper.on('close', (code) => {
        if (code === 0) {
          console.log(chalk.blue('🔧 Piper TTS détecté dans venv'));
          this.config.piperPath = venvPiperPath;
          resolve();
        } else {
          const systemPiper = spawn('piper', ['--help'], { stdio: 'pipe' });
          
          systemPiper.on('close', (sysCode) => {
            if (sysCode === 0) {
              console.log(chalk.blue('🔧 Piper TTS détecté dans PATH'));
              this.config.piperPath = 'piper';
              resolve();
            } else {
              reject(new Error('Piper TTS non installé. Installez-le avec: pip install piper-tts'));
            }
          });
          
          systemPiper.on('error', () => {
            reject(new Error('Piper TTS non installé. Installez-le avec: pip install piper-tts'));
          });
        }
      });
      
      piper.on('error', () => {
        const systemPiper = spawn('piper', ['--help'], { stdio: 'pipe' });
        
        systemPiper.on('close', (sysCode) => {
          if (sysCode === 0) {
            console.log(chalk.blue('🔧 Piper TTS détecté dans PATH'));
            this.config.piperPath = 'piper';
            resolve();
          } else {
            reject(new Error('Piper TTS non installé. Installez-le avec: pip install piper-tts'));
          }
        });
        
        systemPiper.on('error', () => {
          reject(new Error('Piper TTS non installé. Installez-le avec: pip install piper-tts'));
        });
      });
    });
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async downloadFile(url: string, filePath: string): Promise<void> {
    try {
      const { default: fetch } = await import('node-fetch');
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      await fs.writeFile(filePath, Buffer.from(buffer));
    } catch (error) {
      throw new Error(`Erreur téléchargement ${url}: ${error.message}`);
    }
  }

  private async ensureFrenchModel(): Promise<void> {
    const modelPath = path.join(this.modelsDir, 'piper', 'fr_FR-tom-medium.onnx');
    const configPath = path.join(this.modelsDir, 'piper', 'fr_FR-tom-medium.onnx.json');
    
    if (await this.fileExists(modelPath) && await this.fileExists(configPath)) {
      console.log(chalk.blue('✅ Modèle français déjà téléchargé'));
      this.config.modelPath = modelPath;
      this.config.configPath = configPath;
      return;
    }
    
    console.log(chalk.yellow('📥 Téléchargement du modèle français...'));
    await this.downloadFrenchModel();
  }

  private async downloadFrenchModel(): Promise<void> {
    const modelName = 'fr_FR-mls-medium';
    const modelUrl = `https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/tom/medium/${modelName}.onnx`;
    const configUrl = `https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/tom/medium/${modelName}.onnx.json`;
    
    const modelPath = path.join(this.modelsDir, 'piper', `${modelName}.onnx`);
    const configPath = path.join(this.modelsDir, 'piper', `${modelName}.onnx.json`);
    
    const piperDir = path.join(this.modelsDir, 'piper');
    await fs.mkdir(piperDir, { recursive: true });
    
    await this.downloadFile(modelUrl, modelPath);
    await this.downloadFile(configUrl, configPath);
    
    this.config.modelPath = modelPath;
    this.config.configPath = configPath;
    
    console.log(chalk.green('✅ Modèle français téléchargé'));
  }

  async synthesize(text: string, outputPath?: string): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.config.modelPath || !this.config.configPath) {
      throw new Error('Modèle Piper non configuré');
    }

    const outputFile = outputPath || path.join(this.tempDir, `tts_${Date.now()}.wav`);
    const inputFile = path.join(this.tempDir, `input_${Date.now()}.txt`);

    console.log(chalk.dim(`🔧 Piper - Arguments:`));
    console.log(chalk.dim(`   Modèle: ${this.config.modelPath}`));
    console.log(chalk.dim(`   Config: ${this.config.configPath}`));
    console.log(chalk.dim(`   Entrée: ${inputFile}`));
    console.log(chalk.dim(`   Sortie: ${outputFile}`));
    console.log(chalk.dim(`   Texte: "${text}"`));

    return new Promise(async (resolve, reject) => {
      try {
        await fs.writeFile(inputFile, text, 'utf8');
        console.log(chalk.dim(`🔧 Piper - Fichier texte créé: ${inputFile}`));

        const args: string[] = [
          '--model', this.config.modelPath!,
          '--config', this.config.configPath!,
          '--input-file', inputFile,
          '--output-file', outputFile
        ];

        if (this.config.speed && this.config.speed !== 1.0) {
          args.push('--length-scale', this.config.speed.toString());
        }

        const piperCommand = this.config.piperPath || 'piper';
        console.log(chalk.dim(`🔧 Piper - Commande: ${piperCommand} ${args.join(' ')}`));
        
        const piper = spawn(piperCommand, args, { stdio: 'pipe' });
        
        let stdout = '';
        let stderr = '';
        
        piper.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        piper.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        piper.on('close', async (code) => {
          console.log(chalk.dim(`🔧 Piper - Code sortie: ${code}`));
          if (stderr) console.log(chalk.dim(`🔧 Piper - Stderr: ${stderr}`));
          if (stdout) console.log(chalk.dim(`🔧 Piper - Stdout: ${stdout}`));
          
          try {
            await fs.unlink(inputFile);
            console.log(chalk.dim(`🔧 Piper - Fichier texte supprimé: ${inputFile}`));
          } catch (e) {
          }
          
          if (code === 0) {
            try {
              const stats = await fs.stat(outputFile);
              console.log(chalk.green(`✅ Fichier créé: ${outputFile} (${stats.size} octets)`));
              resolve(outputFile);
            } catch (e) {
              console.log(chalk.red(`❌ Fichier non trouvé après synthèse: ${outputFile}`));
              reject(new Error(`Fichier audio non créé: ${outputFile}`));
            }
          } else {
            reject(new Error(`Piper a échoué avec le code ${code}: ${stderr}`));
          }
        });
        
        piper.on('error', (error) => {
          reject(new Error(`Erreur d'exécution Piper: ${error.message}`));
        });
      } catch (error) {
        reject(new Error(`Erreur création fichier texte: ${error.message}`));
      }
    });
  }

  async synthesizeAndPlay(text: string): Promise<void> {
    try {
      console.log(chalk.blue('🔊 Synthèse vocale avec Piper...'));
      
      const audioFile = await this.synthesize(text);
      
      try {
        const stats = await fs.stat(audioFile);
        console.log(chalk.yellow(`📁 Fichier audio généré: ${audioFile} (${stats.size} octets)`));
      } catch (e) {
        console.log(chalk.red(`❌ Fichier audio non trouvé: ${audioFile}`));
      }
      
      await this.playAudioFile(audioFile);
      
      try {
        await fs.unlink(audioFile);
        console.log(chalk.dim(`🧹 Fichier audio supprimé: ${audioFile}`));
      } catch (error) {
        console.error(chalk.red(`❌ Erreur suppression fichier audio: ${error.message}`));
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Erreur synthèse vocale:'), error);
    }
  }

  private async playAudioFile(audioFile: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let command: string;
      let args: string[];

      if (process.platform === 'darwin') {
        command = 'afplay';
        args = [audioFile];
      } else if (process.platform === 'linux') {
        command = 'mpv';
        args = ['--no-video', '--volume=50', audioFile];
      } else {
        command = 'powershell';
        args = ['-c', `Add-Type -AssemblyName System.Windows.Forms; [System.Media.SoundPlayer]::new("${audioFile}").PlaySync()`];
      }

      const player = spawn(command, args, {
        stdio: 'ignore',
        detached: true
      });

      player.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Erreur lecture audio (${code})`));
        }
      });

      player.on('error', (error) => {
        reject(new Error(`Erreur lecture audio: ${error.message}`));
      });
    });
  }

  setConfig(config: Partial<PiperTTSConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): PiperTTSConfig {
    return { ...this.config };
  }

  async cleanup(): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      for (const file of files) {
        if (file.startsWith('tts_')) {
          await fs.unlink(path.join(this.tempDir, file));
        }
      }
    } catch (error) {
    }
  }
}