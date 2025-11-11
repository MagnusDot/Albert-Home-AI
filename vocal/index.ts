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

// Charger les variables d'environnement
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
      // Créer le gestionnaire de session
      this.sessionManager = new SessionManager(this.agent, this.apiKey);

      // Configurer le callback pour réactiver le microphone quand l'audio est vraiment terminé
      this.speakerManager.setOnAudioFinished(() => {
        // Attendre un petit délai supplémentaire pour s'assurer que tout est bien terminé
        setTimeout(() => {
          this.microphoneManager.enable();
          console.log(chalk.green('🎤 Microphone réactivé - Prêt à écouter'));
        }, 500);
      });

      // Configurer les callbacks pour gérer le microphone
      this.sessionManager.setCallbacks({
        onResponseCreated: () => {
          // Arrêter complètement le microphone dès qu'une réponse est créée
          this.microphoneManager.disable();
        },
        onAgentStart: () => {
          // S'assurer que le microphone est arrêté
          this.microphoneManager.disable();
        },
        onAudioStart: () => {
          // S'assurer que le microphone est arrêté quand l'audio démarre
          this.microphoneManager.disable();
        },
        onAudioStop: () => {
          // L'API a fini d'envoyer de l'audio, on ferme le speaker
          // pour qu'il finisse de jouer son buffer et se ferme proprement
          this.speakerManager.stop();
          // Le callback onAudioFinished sera appelé quand le speaker sera vraiment fermé
        },
      });

      // Enregistrer l'événement audio AVANT la connexion
      this.sessionManager.onAudio((audioEvent: any) => {
        if (audioEvent.data) {
          console.log(chalk.dim(`🔊 Audio reçu: ${audioEvent.data.byteLength} bytes`));
          this.speakerManager.playAudio(audioEvent.data);
        } else {
          console.log(chalk.yellow('⚠️  Événement audio sans données'));
        }
      });

      // Se connecter à la session
      await this.sessionManager.connect();
      console.log(chalk.green('✅ Agent vocal connecté et prêt !'));

      // Démarrer le microphone
      try {
        await this.microphoneManager.start((audio) => {
          // Envoyer l'audio à la session seulement si le microphone est activé
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

      // Garder la session active
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

// Point d'entrée
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
