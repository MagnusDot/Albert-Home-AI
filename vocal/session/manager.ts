import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime';
import chalk from 'chalk';

export class SessionManager {
  private session: RealtimeSession | null = null;
  private agent: RealtimeAgent;
  private apiKey: string;
  private onAgentStart?: () => void;
  private onAgentEnd?: () => void;
  private onAudioStart?: () => void;
  private onAudioStop?: () => void;
  private onResponseCreated?: () => void;
  private audioCallback?: (audioEvent: any) => void;

  constructor(agent: RealtimeAgent, apiKey: string) {
    this.agent = agent;
    this.apiKey = apiKey;
  }

  setCallbacks(callbacks: {
    onAgentStart?: () => void;
    onAgentEnd?: () => void;
    onAudioStart?: () => void;
    onAudioStop?: () => void;
    onResponseCreated?: () => void;
  }): void {
    this.onAgentStart = callbacks.onAgentStart;
    this.onAgentEnd = callbacks.onAgentEnd;
    this.onAudioStart = callbacks.onAudioStart;
    this.onAudioStop = callbacks.onAudioStop;
    this.onResponseCreated = callbacks.onResponseCreated;
  }

  async connect(): Promise<void> {
    this.session = new RealtimeSession(this.agent, {
      transport: 'websocket',
      config: {
        audio: {
          input: {
            turnDetection: {
              type: 'server_vad',
              interruptResponse: false,
            },
          },
        },
      },
    });

    this.setupEventHandlers();

    if (this.audioCallback) {
      this.session.on('audio', this.audioCallback);
    }

    await this.session.connect({
      apiKey: this.apiKey,
    });
  }

  private setupEventHandlers(): void {
    if (!this.session) return;

    this.session.on('agent_tool_start', (context, agent, tool) => {
      console.log(chalk.yellow(`🔧 Appel d'outil: ${tool.name}`));
    });

    this.session.on('agent_tool_end', (context, agent, tool, result) => {
      console.log(chalk.green(`✅ Outil ${tool.name} terminé: ${result}`));
    });

    this.session.on('agent_start', () => {
      console.log(chalk.blue('🤖 Agent démarre...'));
      this.onAgentStart?.();
    });

    this.session.on('agent_end', (context, agent, output) => {
      console.log(chalk.blue(`🤖 Agent terminé: ${output}`));
      this.onAgentEnd?.();
    });

    this.session.on('audio_start', () => {
      console.log(chalk.blue('🔊 Audio démarre...'));
      this.onAudioStart?.();
    });

    this.session.on('audio_stopped', () => {
      console.log(chalk.blue('🔇 Audio arrêté'));
      this.onAudioStop?.();
    });

    this.session.on('transport_event', (event: any) => {
      if (event.type === 'response.created') {
        console.log(chalk.yellow('🛑 Réponse créée'));
        this.onResponseCreated?.();
      }
    });

    this.session.on('history_added', (item: any) => {
      if (item.type === 'message' && item.role === 'user') {
        const textContent = item.content?.find((c: any) => c.type === 'input_text')?.text;
        const audioContent = item.content?.find((c: any) => c.type === 'input_audio');
        if (textContent) {
          console.log(chalk.cyan(`💬 Vous: ${textContent}`));
        } else if (audioContent?.transcript) {
          console.log(chalk.cyan(`💬 Vous: ${audioContent.transcript}`));
        }
      }
      if (item.type === 'message' && item.role === 'assistant') {
        const textContent = item.content?.find((c: any) => c.type === 'text')?.text;
        if (textContent) {
          console.log(chalk.green(`🤖 Albert: ${textContent}`));
        }
      }
      if (item.type === 'response_audio_transcript_delta' || item.type === 'response_audio_transcript_done') {
        if (item.transcript) {
          console.log(chalk.green(`🤖 Albert: ${item.transcript}`));
        }
      }
    });

    this.session.on('error', (errorEvent: any) => {
      const error = errorEvent?.error || errorEvent;
      const errorMessage = error?.message || error?.toString() || 'Erreur inconnue';
      console.error(chalk.red(`❌ Erreur: ${errorMessage}`));
    });
  }

  sendAudio(audio: ArrayBuffer): void {
    if (this.session) {
      this.session.sendAudio(audio);
    }
  }

  sendMessage(message: string): void {
    if (this.session) {
      this.session.sendMessage(message);
    }
  }

  onAudio(callback: (audioEvent: any) => void): void {
    this.audioCallback = callback;
    if (this.session) {
      this.session.on('audio', callback);
    }
  }

  close(): void {
    if (this.session) {
      this.session.close();
      this.session = null;
    }
  }
}

