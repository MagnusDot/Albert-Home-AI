import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Types
export interface AgentConfig {
  id: string;
  name: string;
  description: string;
}

export interface Config {
  api_url: string;
  agents: AgentConfig[];
  bearer_token?: string;
}

// Configuration management
export class ConfigManager {
  private config: Config | null = null;

  async getConfig(): Promise<Config> {
    if (this.config) return this.config;

    // Le bearer token est TOUJOURS requis depuis le .env
    const bearerToken = process.env.BEARER;
    if (!bearerToken) {
      console.error('❌ ERREUR: La variable BEARER doit être définie dans le fichier .env');
      console.error('💡 Créez un fichier .env avec: BEARER=votre-token');
      process.exit(1);
    }

    // 1. Try environment variables first
    if (process.env.API_URL) {
      this.config = {
        api_url: process.env.API_URL,
        agents: [],
        bearer_token: bearerToken
      };
      return this.config;
    }

    // 2. Try JSON config file
    try {
      const configPath = path.join(__dirname, 'agents_config.json');
      const configData = await fs.readFile(configPath, 'utf-8');
      this.config = JSON.parse(configData);
      
      // TOUJOURS utiliser le bearer token du .env
      this.config!.bearer_token = bearerToken;
      
      return this.config!;
    } catch (error) {
      // 3. Fallback to default config
      this.config = {
        api_url: "http://localhost:8080",
        agents: [
          {
            id: "albert",
            name: "Albert",
            description: "Albert IA est un agent qui peut répondre à vos questions et vous aider dans la vie quotidienne"
          }
        ],
        bearer_token: bearerToken
      };
      return this.config;
    }
  }
} 