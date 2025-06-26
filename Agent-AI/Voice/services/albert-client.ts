import { AlbertResponse, VoiceConfig } from '../types/index.js';

export class AlbertClient {
  private config: VoiceConfig;
  private conversationId: string;

  constructor(config: VoiceConfig, conversationId: string) {
    this.config = config;
    this.conversationId = conversationId;
  }

  async sendMessage(transcription: string, threadId?: string | null): Promise<AlbertResponse> {
    try {
      const requestBody: any = {
        message: transcription,
        conversation_id: this.conversationId
      };
      
      if (threadId) {
        requestBody.thread_id = threadId;
      }
      
      const fetchPromise = fetch(`${this.config.api_url}/albert/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.bearer_token}`
        },
        body: JSON.stringify(requestBody)
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('API timeout')), 15000)
      );
      
      const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;

      if (response.ok) {
        return await response.json();
      } else {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }
      
    } catch (error) {
      if (error.message === 'API timeout') {
        throw new Error('API Albert trop lente (>15s)');
      }
      throw error;
    }
  }
} 