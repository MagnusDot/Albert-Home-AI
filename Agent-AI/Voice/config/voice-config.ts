import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { VoiceConfig } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class VoiceConfigManager {
  private static instance: VoiceConfigManager;
  private config: VoiceConfig;
  private accessKey: string;
  private usePorcupine: boolean = false;

  private constructor() {
    this.config = {
      api_url: 'http://localhost:8080',
      bearer_token: undefined
    };
    this.accessKey = 'YOUR_ACCESS_KEY_HERE';
  }

  static getInstance(): VoiceConfigManager {
    if (!VoiceConfigManager.instance) {
      VoiceConfigManager.instance = new VoiceConfigManager();
    }
    return VoiceConfigManager.instance;
  }

  async loadConfig(): Promise<void> {
    const envPath = path.join(__dirname, '..', '..', '.env');
    
    console.log(chalk.dim(`🔧 Chargement config depuis: ${envPath}`));
    console.log(chalk.dim(`   Fichier existe: ${fs.existsSync(envPath)}`));
    
    if (fs.existsSync(envPath)) {
      const dotenv = await import('dotenv');
      dotenv.config({ path: envPath });
      console.log(chalk.green('✅ Fichier .env chargé'));
    } else {
      console.log(chalk.yellow('⚠️ Fichier .env non trouvé'));
    }
    
    this.config = {
      api_url: process.env.API_URL || 'http://localhost:8080',
      bearer_token: process.env.BEARER
    };
    
    this.accessKey = process.env.PICOVOICE_ACCESS_KEY || 'YOUR_ACCESS_KEY_HERE';
    this.usePorcupine = this.accessKey !== 'YOUR_ACCESS_KEY_HERE';
    
    console.log(chalk.dim(`   PICOVOICE_ACCESS_KEY: ${this.accessKey.substring(0, 10)}...`));
    console.log(chalk.dim(`   Use Porcupine: ${this.usePorcupine}`));
  }

  getConfig(): VoiceConfig {
    return this.config;
  }

  getAccessKey(): string {
    return this.accessKey;
  }

  isPorcupineEnabled(): boolean {
    return this.usePorcupine;
  }

  validateConfig(): boolean {
    return !!this.config.bearer_token;
  }
} 