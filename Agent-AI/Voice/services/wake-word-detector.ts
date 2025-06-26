import { Porcupine } from '@picovoice/porcupine-node';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { WakeWordDetection } from '../types/index.js';
import { WhisperService } from './whisper-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WakeWordDetector {
  private porcupine: Porcupine | null = null;
  private whisperService: WhisperService;
  private accessKey: string;
  private usePorcupine: boolean;
  private isInitialized = false;

  constructor(accessKey: string, usePorcupine: boolean, whisperService: WhisperService) {
    this.accessKey = accessKey;
    this.usePorcupine = usePorcupine;
    this.whisperService = whisperService;
    
    console.log(chalk.dim('🔧 WakeWordDetector - Configuration:'));
    console.log(chalk.dim(`   Access Key: ${accessKey.substring(0, 10)}...`));
    console.log(chalk.dim(`   Use Porcupine: ${usePorcupine}`));
    console.log(chalk.dim(`   Key valid: ${accessKey !== 'YOUR_ACCESS_KEY_HERE'}`));
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;


    if (this.usePorcupine) {
      try {
        await this.setupPorcupine();
      } catch (error) {
        console.error('❌ Erreur initialisation Porcupine:', error.message);
        console.log('💡 Utilisation du mode fallback');
        this.usePorcupine = false;
        this.porcupine = null;
      }
    }
    
    this.isInitialized = true;
  }

  private async setupPorcupine(): Promise<void> {
    const keywordPath = path.join(__dirname, '..', 'models', 'albert.ppn');
    
    console.log(chalk.blue('🔧 Initialisation Porcupine...'));
    console.log(chalk.dim(`   Vérification wake word: ${keywordPath}`));
    
    if (!fs.existsSync(keywordPath)) {
      throw new Error(`Fichier wake word manquant: ${keywordPath}`);
    }
    
    console.log(chalk.green('✅ Fichier wake word trouvé'));
    
    const modelPath = await this.downloadFrenchModel();
    console.log(chalk.dim(`   Modèle: ${modelPath || 'défaut'}`));
    console.log(chalk.dim(`   Clé: ${this.accessKey.substring(0, 10)}...`));
    
    try {
      console.log(chalk.dim('   Création instance Porcupine'));
      this.porcupine = new Porcupine(
        this.accessKey,
        [keywordPath],
        [0.7],
        modelPath || undefined
      );
      
      console.log(chalk.green('✅ Porcupine initialisé avec succès'));
    } catch (error) {
      console.error(chalk.red('❌ Erreur création instance Porcupine:'), error);
      throw error;
    }
  }

  private async downloadFrenchModel(): Promise<string> {
    const modelsDir = path.join(__dirname, '..', 'models');
    await fs.ensureDir(modelsDir);
    
    const modelPath = path.join(modelsDir, 'porcupine_params_fr.pv');
    
    console.log(chalk.dim(`   Vérification modèle français: ${modelPath}`));
    
    if (await fs.pathExists(modelPath)) {
      console.log(chalk.green('✅ Modèle français trouvé'));
      return modelPath;
    }
    
          console.log(chalk.yellow('⚠️ Modèle français manquant, téléchargement'));
    
    try {
      const modelUrl = `https://github.com/Picovoice/porcupine/raw/master/lib/common/porcupine_params_fr.pv`;
      const response = await fetch(modelUrl);
      
      if (!response.ok) {
        throw new Error(`Erreur téléchargement: ${response.status}`);
      }
      
      const buffer = await response.arrayBuffer();
      await fs.writeFile(modelPath, Buffer.from(buffer));
      
      console.log(chalk.green('✅ Modèle français téléchargé'));
      return modelPath;
    } catch (error) {
      console.log(chalk.yellow('⚠️ Échec téléchargement, modèle par défaut'));
      return '';
    }
  }

  async detectWithPorcupine(frame: Int16Array): Promise<WakeWordDetection> {
    if (!this.porcupine) {
      return { detected: false, detectionTime: 0, method: 'porcupine' };
    }

    const startTime = performance.now();
    const keywordIndex = this.porcupine.process(frame);
    const detectionTime = performance.now() - startTime;

    return {
      detected: keywordIndex >= 0,
      keywordIndex: keywordIndex >= 0 ? keywordIndex : undefined,
      detectionTime,
      method: 'porcupine'
    };
  }

  async detectWithWhisper(audioBuffer: Buffer): Promise<WakeWordDetection> {
    const startTime = performance.now();
    const transcription = await this.whisperService.transcribeWithTimeout(audioBuffer);
    const detectionTime = performance.now() - startTime;

    const detected = transcription.toLowerCase().includes('hey albert') || 
                    transcription.toLowerCase().includes('albert');

    return {
      detected,
      detectionTime,
      method: 'whisper'
    };
  }

  isPorcupineAvailable(): boolean {
    return this.usePorcupine && this.porcupine !== null;
  }

  cleanup(): void {
    if (this.porcupine) {
      try {
        this.porcupine.release();
      } catch (error) {
      }
    }
  }
} 