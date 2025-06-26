import type { CompiledStateGraph } from '@langchain/langgraph';
import 'dotenv/config';

import { albertAgent } from '../Agents/albert/albert.mts';

export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  agent: CompiledStateGraph<any, any>;
}

// Registre des agents - Ajoutez vos agents ici
export const AGENTS_REGISTRY: Record<string, AgentInfo> = {
  albert: {
    id: 'albert',
    name: 'Albert IA',
    description: 'Albert IA est un agent qui peut répondre à vos questions et vous aider dans la vie quotidienne',
    agent: albertAgent
  }
};

// Fonction pour récupérer un agent par son ID
export function getAgent(agentId: string): CompiledStateGraph<any, any> {
  const agentInfo = AGENTS_REGISTRY[agentId];
  if (!agentInfo) {
    throw new Error(`Agent '${agentId}' non trouvé. Agents disponibles: ${Object.keys(AGENTS_REGISTRY).join(', ')}`);
  }
  return agentInfo.agent;
}

// Fonction pour récupérer la liste de tous les agents
export function getAllAgents(): AgentInfo[] {
  return Object.values(AGENTS_REGISTRY);
}

// Fonction pour récupérer les métadonnées des agents (sans l'instance)
export function getAgentsMetadata() {
  return Object.values(AGENTS_REGISTRY).map(({ id, name, description }) => ({
    id,
    name,
    description
  }));
} 