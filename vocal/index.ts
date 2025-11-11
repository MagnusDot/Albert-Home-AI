#!/usr/bin/env node

import { RealtimeAgent } from '@openai/agents/realtime';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { MicrophoneManager } from './audio/microphone.js';
import { SpeakerManager } from './audio/speaker.js';
import { loadAlbertPrompt } from './config/prompt.js';
import { SessionManager } from './session/manager.js';
import { getTools } from './tools/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

export class AlbertVoiceAgent {
  private agent: RealtimeAgent;
  private sessionManager: SessionManager | null = null;
  private microphoneManager: MicrophoneManager;
  private speakerManager: SpeakerManager;
  private apiKey: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY manquante dans les variables d\'environnement');
    }
    this.apiKey = apiKey;

    const prompt = loadAlbertPrompt();
    const tools = getTools();

    this.agent = new RealtimeAgent({
      name: 'Albert',
      instructions: prompt,
      tools: tools,
      voice: 'alloy',
    });

    this.microphoneManager = new MicrophoneManager();
    this.speakerManager = new SpeakerManager();
  }

  async start(): Promise<void> {
    console.log(chalk.blue('🎤 Albert Voice Agent - OpenAI'));
    console.log(chalk.dim('🚀 Initialisation de l\'agent vocal...'));

    try {
      this.sessionManager = new SessionManager(this.agent, this.apiKey);

      this.speakerManager.setOnAudioFinished(() => {
        setTimeout(() => {
          this.microphoneManager.enable();
          console.log(chalk.green('🎤 Microphone réactivé - Prêt à écouter'));
        }, 500);
      });

      this.sessionManager.setCallbacks({
        onResponseCreated: () => {
          this.microphoneManager.disable();
        },
        onAgentStart: () => {
          this.microphoneManager.disable();
        },
        onAudioStart: () => {
          this.microphoneManager.disable();
        },
        onAudioStop: () => {
          this.speakerManager.stop();
        },
      });

      this.sessionManager.onAudio((audioEvent: any) => {
        if (audioEvent.data) {
          this.speakerManager.playAudio(audioEvent.data);
        }
      });

      await this.sessionManager.connect();
      console.log(chalk.green('✅ Agent vocal connecté et prêt !'));

      try {
        await this.microphoneManager.start((audio) => {
          if (this.sessionManager) {
            this.sessionManager.sendAudio(audio);
          }
        });
      } catch (error) {
        console.log(chalk.yellow('💡 Mode texte uniquement - envoi d\'un message de test...'));
        setTimeout(() => {
          if (this.sessionManager) {
            console.log(chalk.blue('📤 Envoi message test: "Bonjour Albert"'));
            this.sessionManager.sendMessage('Bonjour Albert, comment ça va ?');
          }
        }, 1000);
      }

      process.on('SIGINT', async () => {
        console.log(chalk.blue('\n🧹 Fermeture de la session...'));
        await this.cleanup();
        process.exit(0);
      });

    } catch (error: any) {
      console.error(chalk.red('❌ Erreur lors du démarrage:'), error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    this.microphoneManager.stop();
    this.speakerManager.stop();
    if (this.sessionManager) {
      this.sessionManager.close();
      this.sessionManager = null;
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const voiceAgent = new AlbertVoiceAgent();
  
  voiceAgent.start()
    .then(() => {
      console.log(chalk.green('🦔 Albert Voice Agent démarré'));
    })
    .catch((error) => {
      console.error(chalk.red('❌ Erreur fatale:'), error);
      process.exit(1);
    });
}
