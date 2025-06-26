#!/usr/bin/env node

import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';
import { VoiceConfigManager } from './config/voice-config.js';
import { AlbertClient } from './services/albert-client.js';
import { PiperTTSService } from './services/piper-tts.js';
import { RecordingManager } from './services/recording-manager.js';
import { SoundPlayer } from './services/sound-player.js';
import { WakeWordDetector } from './services/wake-word-detector.js';
import { WhisperService } from './services/whisper-service.js';
import { DetectionStats, ThreadInfo } from './types/index.js';
import { AudioUtils } from './utils/audio-utils.js';

export class VoiceClient {
  private configManager: VoiceConfigManager;
  private wakeWordDetector: WakeWordDetector;
  private whisperService: WhisperService;
  private recordingManager: RecordingManager;
  private soundPlayer: SoundPlayer;
  private albertClient: AlbertClient;
  private piperTTS: PiperTTSService;
  private conversationId: string;
  private detectionStats: DetectionStats;
  private isListening = false;
  private threadInfo: ThreadInfo | null = null;
  private readonly THREAD_EXPIRATION_MS = 10 * 60 * 1000;

  constructor() {
    this.conversationId = `voice-${uuidv4()}`;
    this.configManager = VoiceConfigManager.getInstance();
    this.whisperService = new WhisperService('base');
    this.recordingManager = new RecordingManager();
    this.soundPlayer = SoundPlayer.getInstance();
    this.piperTTS = PiperTTSService.getInstance();
    this.detectionStats = {
      totalDetections: 0,
      avgLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      transcriptionTime: 0,
      falsePositives: 0
    };
  }

  async initialize(): Promise<void> {
    await this.configManager.loadConfig();
    
    if (!this.configManager.validateConfig()) {
      throw new Error('Configuration invalide: BEARER token manquant');
    }

    this.wakeWordDetector = new WakeWordDetector(
      this.configManager.getAccessKey(),
      this.configManager.isPorcupineEnabled(),
      this.whisperService
    );

    const config = this.configManager.getConfig();
    this.albertClient = new AlbertClient(config, this.conversationId);

    await this.whisperService.initialize();
    await this.wakeWordDetector.initialize();
    await this.piperTTS.initialize();

    this.logConfiguration();
  }

  private logConfiguration(): void {
    const config = this.configManager.getConfig();
    console.log(chalk.blue('🔧 Configuration chargée:'));
    console.log(chalk.dim(`   API URL: ${config.api_url}`));
    console.log(chalk.dim(`   BEARER: ${config.bearer_token ? '✅ Configuré' : '❌ Manquant'}`));
    console.log(chalk.dim(`   Porcupine: ${this.configManager.isPorcupineEnabled() ? '✅ Configuré' : '❌ Non configuré'}`));
  }

  async start(): Promise<void> {
    console.log(chalk.blue('🦔 Albert Voice Client'));
    console.log(chalk.dim('🎯 Détection wake word professionnelle (<100ms)'));

    if (this.wakeWordDetector.isPorcupineAvailable()) {
      console.log(chalk.green('✅ Système Porcupine initialisé'));
      console.log(chalk.dim('🎤 Dites "Hey Albert" pour activer...'));
      await this.startListeningLoop();
    } else {
      console.log(chalk.yellow('⚠️ Mode fallback activé (Whisper)'));
      console.log(chalk.dim('🎤 Dites "Hey Albert" ou "Albert" pour activer...'));
      await this.startFallbackListening();
    }
  }

  private async startListeningLoop(): Promise<void> {
    let isFirstStart = true;
    while (true) {
      try {
        if (isFirstStart) {
          console.log(chalk.blue('🎤 Démarrage écoute Porcupine...'));
          isFirstStart = false;
        } else {
          console.log(chalk.blue('🔄 Redémarrage écoute Porcupine...'));
        }
        await this.startPorcupineListening();
      } catch (error) {
        console.error(chalk.red('❌ Erreur dans la boucle d\'écoute:'), error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  private async startPorcupineListening(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let isProcessing = false;
      let lastDetectionTime = 0;
      const cooldownPeriod = 2000;
      let audioBuffer: number[] = [];
      const frameLength = 512;

      this.recordingManager.startRecording(
        {
          sampleRateHertz: 16000,
          threshold: 0,
          silence: '0.1',
          endOnSilence: false
        },
        async (chunk: Buffer) => {
          if (isProcessing || this.isListening) return;
          
          const now = Date.now();
          if (now - lastDetectionTime < cooldownPeriod) return;

          try {
            const int16 = new Int16Array(chunk.buffer, chunk.byteOffset, chunk.length / 2);
            
            for (let i = 0; i < int16.length; i++) {
              audioBuffer.push(int16[i]);
            }
            
            const audioInfo = AudioUtils.getAudioLevelInfo(chunk);
            
            while (audioBuffer.length >= frameLength) {
              const frameData = audioBuffer.splice(0, frameLength);
              const frame = new Int16Array(frameData);
              
              const detection = await this.wakeWordDetector.detectWithPorcupine(frame);
              
              if (detection.detected) {
                console.log(chalk.green(`🎯 WAKE WORD DÉTECTÉ ! (${detection.detectionTime.toFixed(1)}ms)`));
                console.log(chalk.dim(`📊 Index: ${detection.keywordIndex}`));
                
                await this.soundPlayer.playWakeWordSound();
                this.updateDetectionStats(detection.detectionTime);
                
                lastDetectionTime = now;
                isProcessing = true;
                
                this.recordingManager.stopRecording();
                
                let attempts = 0;
                while (this.recordingManager.isCurrentlyRecording() && attempts < 50) {
                  await new Promise(res => setTimeout(res, 100));
                  attempts++;
                }
                
                if (attempts >= 50) {
                  console.log(chalk.yellow('⚠️ Timeout arrêt enregistrement Porcupine'));
                }
                
                await new Promise(res => setTimeout(res, 200));
                this.isListening = true;
                await this.startMainRecording();
                this.isListening = false;
                
                isProcessing = false;
                resolve();
                return;
              }
            }
          } catch (error) {
            console.error(chalk.red('❌ Erreur traitement Porcupine:'), error);
            reject(error);
          }
        },
        () => {
          console.log(chalk.dim('⏹️ Écoute Porcupine terminée'));
          resolve();
        },
        (error: Error) => {
          console.error(chalk.red('❌ Erreur écoute Porcupine:'), error);
          reject(error);
        }
      );
    });
  }

  private async startFallbackListening(): Promise<void> {
    console.log(chalk.blue('🎤 Démarrage écoute fallback (Whisper)...'));

    let isProcessing = false;
    let lastDetectionTime = 0;
    const cooldownPeriod = 2000;
    const audioBuffer: Buffer[] = [];

    this.recordingManager.startRecording(
      {
        sampleRateHertz: 16000,
        threshold: 0.3,
        silence: '0.1',
        endOnSilence: false
      },
      async (chunk: Buffer) => {
        if (isProcessing || this.isListening) return;
        
        audioBuffer.push(chunk);
        if (audioBuffer.length > 32) {
          audioBuffer.shift();
        }

        const now = Date.now();
        if (now - lastDetectionTime < cooldownPeriod) return;

        const buffer = Buffer.concat(audioBuffer);
        const amplitude = AudioUtils.calculateAudioLevel(buffer);
        
        if (amplitude > 0.015) {
          isProcessing = true;
          
          try {
            const detection = await this.wakeWordDetector.detectWithWhisper(buffer);
            
            if (detection.detected) {
              console.log(chalk.green(`🎯 WAKE WORD DÉTECTÉ ! (${detection.detectionTime.toFixed(1)}ms)`));
              
              await this.soundPlayer.playWakeWordSound();
              this.updateDetectionStats(detection.detectionTime);
              
              lastDetectionTime = now;
              this.isListening = true;
              await this.startMainRecording();
              this.isListening = false;
            }
          } catch (error) {
            console.error(chalk.red('❌ Erreur fallback:'), error);
          } finally {
            isProcessing = false;
          }
        }
      },
      () => console.log(chalk.dim('⏹️ Écoute fallback terminée')),
      (error: Error) => {
        console.error(chalk.red('❌ Erreur écoute fallback:'), error);
        setTimeout(() => this.startFallbackListening(), 1000);
      }
    );
  }

  private async startMainRecording(): Promise<void> {
    return new Promise<void>(async (resolve) => {
      console.log(chalk.blue('🎙️ Enregistrement principal démarré...'));
      console.log(chalk.dim('💡 Parlez maintenant, arrêt automatique après 1s de silence'));
      
      const record = (await import('node-record-lpcm16')).default;
      const chunks: Buffer[] = [];
      let chunkCount = 0;
      let hasAudio = false;
      let lastAudioTime = Date.now();
      let shouldProcess = true;

      const rec = record.record({
        sampleRateHertz: 16000,
        threshold: 0.5,
        verbose: true,
        recordProgram: 'rec',
        silence: '1.0',
        endOnSilence: true
      });

      const noAudioTimeout = setTimeout(() => {
        if (!hasAudio) {
          console.log(chalk.yellow('⏰ Aucun son détecté pendant 3s'));
          shouldProcess = false;
          rec.stop();
          resolve();
        }
      }, 3000);

      rec.stream()
        .on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          chunkCount++;
          const level = AudioUtils.calculateAudioLevel(chunk);
          if (level > 0.01) {
            hasAudio = true;
            lastAudioTime = Date.now();
            clearTimeout(noAudioTimeout);
          }
          if (chunkCount % 16 === 0) {
            const audioInfo = AudioUtils.getAudioLevelInfo(chunk);
          }
        })
        .on('end', async () => {
          clearTimeout(noAudioTimeout);
          if (shouldProcess && hasAudio && chunks.length > 0) {
            console.log(chalk.blue('⏹️ Enregistrement terminé - Traitement en cours...'));
            const audioBuffer = Buffer.concat(chunks);
            await this.processMainAudio(audioBuffer);
          } else {
            console.log(chalk.dim('🔇 Enregistrement terminé - Aucun audio valide'));
          }
          resolve();
        })
        .on('error', (error: Error) => {
          clearTimeout(noAudioTimeout);
          console.error(chalk.red('❌ Erreur enregistrement principal:'), error);
          resolve();
        });
    });
  }

  private async processMainAudio(audioBuffer: Buffer): Promise<void> {
    try {
      console.log(chalk.blue('🔍 Transcription avec Whisper...'));
      
      const transcription = await this.whisperService.transcribeWithTimeout(audioBuffer);
      
      if (transcription.trim()) {
        console.log(chalk.green(`💬 Transcription: "${transcription}"`));
        await this.sendToAlbert(transcription);
      } else {
        console.log(chalk.yellow('⚠️ Aucune transcription détectée'));
      }
    } catch (error) {
      if (error.message === 'Transcription timeout') {
        console.error(chalk.red('❌ Transcription trop lente (>10s), arrêt'));
      } else {
        console.error(chalk.red('❌ Erreur traitement audio:'), error);
      }
    }
  }

  private async sendToAlbert(transcription: string): Promise<void> {
    try {
      console.log(chalk.blue('🤖 Envoi à Albert...'));
      
      const result = await this.albertClient.sendMessage(transcription, this.getCurrentThreadId());
      
      if (result.conversation_id) {
        this.updateThreadInfo(result.conversation_id);
      }
      
      const response = result.content || result.response || result.message || 'Aucune réponse';
      console.log(chalk.green('✅ Réponse d\'Albert:'));
      console.log(chalk.white(response));
      
      if (response && response !== 'Aucune réponse') {
        await this.piperTTS.synthesizeAndPlay(response);
      }
    } catch (error) {
      if (error.message === 'API Albert trop lente (>15s)') {
        console.error(chalk.red('❌ API Albert trop lente (>15s), arrêt'));
      } else {
        console.error(chalk.red('❌ Erreur communication avec Albert:'), error);
      }
    }
  }

  private getCurrentThreadId(): string | null {
    if (!this.threadInfo) {
      return null;
    }
    
    const now = Date.now();
    if (now - this.threadInfo.lastUsed > this.THREAD_EXPIRATION_MS) {
      console.log(chalk.yellow('⏰ Thread expiré, nouveau thread créé'));
      this.threadInfo = null;
      return null;
    }
    
    return this.threadInfo.thread_id;
  }

  private updateThreadInfo(threadId: string): void {
    this.threadInfo = {
      thread_id: threadId,
      lastUsed: Date.now()
    };
    console.log(chalk.dim(`🧵 Thread mis à jour: ${threadId}`));
  }

  private updateDetectionStats(detectionTime: number): void {
    this.detectionStats.totalDetections++;
    this.detectionStats.avgLatency = 
      (this.detectionStats.avgLatency * (this.detectionStats.totalDetections - 1) + detectionTime) / 
      this.detectionStats.totalDetections;
    this.detectionStats.maxLatency = Math.max(this.detectionStats.maxLatency, detectionTime);
    this.detectionStats.minLatency = Math.min(this.detectionStats.minLatency, detectionTime);
  }

  getPerformanceMetrics(): DetectionStats & { targetMet: boolean } {
    return {
      ...this.detectionStats,
      targetMet: this.detectionStats.avgLatency < 100
    };
  }

  async cleanup(): Promise<void> {
    this.isListening = false;
    this.wakeWordDetector.cleanup();
    this.recordingManager.stopRecording();
    await this.piperTTS.cleanup();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const client = new VoiceClient();
  
  client.initialize()
    .then(() => client.start())
    .then(() => {
      console.log(chalk.green('🦔 Client Voice démarré'));
      console.log(chalk.dim('🎯 Objectif : Détection professionnelle <100ms !'));
    })
    .catch(console.error);
  
  process.on('SIGINT', async () => {
    console.log(chalk.blue('\n🧹 Nettoyage des ressources...'));
    await client.cleanup();
    process.exit(0);
  });
} 