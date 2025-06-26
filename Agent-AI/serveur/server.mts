#!/usr/bin/env node

import { HumanMessage } from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import cors from 'cors';
import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { getAgent, getAgentsMetadata } from './agents-registry.mts';
import {
  logError,
  logMessageReceived,
  logMessageSent,
  logNewConversation,
  logResumeConversation,
  logToolExecution
} from './logger.mts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AgentConfig {
  id: string;
  name: string;
  description: string;
}

interface UserInput {
  message: string;
  thread_id?: string;
  conversation_id?: string;
  chat_id?: string;
  context?: any;
  details?: any;
}

interface AgentResponse {
  content: string;
  thread_id: string;
  run_id: string;
}

interface ChatMessage {
  type: 'human' | 'ai' | 'tool';
  content: string;
  timestamp: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

interface ConversationState {
  thread_id: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

const API_VERSION = "1.0.0";
const API_TITLE = "Agent CLI Server";
const API_DESCRIPTION = "Serveur Express.js pour le CLI des agents IA";
const PORT = process.env.PORT || 8080;

const conversations: Map<string, ConversationState> = new Map();
const activeGenerations: Map<string, boolean> = new Map();

async function loadAgentsConfig(): Promise<AgentConfig[]> {
  try {
    const agents = getAgentsMetadata();
    console.log(`✅ ${agents.length} agent(s) chargé(s) depuis le registre:`, agents.map(a => a.id).join(', '));
    return agents;
  } catch (error) {
    console.warn('⚠️ Erreur lors du chargement des agents depuis le registre:', error);
    return [];
  }
}

function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  const requireAuth = process.env.REQUIRE_AUTH?.toLowerCase() !== 'false';

  if (!token && requireAuth) {
    return res.status(401).json({ error: 'Token d\'accès requis' });
  }

  (req as any).token = token;
  next();
}

function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error('Erreur serveur:', err);
  res.status(500).json({
    error: 'Erreur interne du serveur',
    message: err.message,
    path: req.path
  });
}

function getOrCreateConversation(threadId: string): ConversationState {
  if (!conversations.has(threadId)) {
    const now = new Date().toISOString();
    conversations.set(threadId, {
      thread_id: threadId,
      messages: [],
      created_at: now,
      updated_at: now
    });
  }
  return conversations.get(threadId)!;
}

function addMessageToConversation(threadId: string, message: ChatMessage) {
  const conversation = getOrCreateConversation(threadId);
  conversation.messages.push(message);
  conversation.updated_at = new Date().toISOString();
}

function extractRequestMetadata(req: Request) {
  return {
    user_agent: req.get('User-Agent'),
    ip_address: req.ip || req.connection.remoteAddress,
    session_id: req.get('X-Session-ID')
  };
}

const app = express();

app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.text());

app.get('/health', async (req: Request, res: Response) => {
  try {
    const agents = await loadAgentsConfig();
    res.json({
      status: 'ok',
      version: API_VERSION,
      title: API_TITLE,
      description: API_DESCRIPTION,
      timestamp: new Date().toISOString(),
      agents_count: agents.length,
      available_agents: agents.map(a => a.id),
      components: {
        api: 'healthy',
        agents: 'healthy',
        database: 'healthy'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Erreur lors de la vérification de santé'
    });
  }
});

app.get('/agents', authenticateToken, async (req: Request, res: Response) => {
  try {
    const agents = await loadAgentsConfig();
    res.json(agents);
  } catch (error) {
    console.error('Erreur lors du chargement des agents:', error);
    res.status(500).json({
      error: 'Erreur lors du chargement des agents',
      message: (error as Error).message
    });
  }
});

app.post('/:agentId/invoke', authenticateToken, async (req: Request, res: Response) => {
  const { agentId } = req.params;
  const userInput: UserInput = req.body;
  
  try {
    const threadId = userInput.thread_id || uuidv4();
    const runId = uuidv4();
    const metadata = extractRequestMetadata(req);
    
    const agent = getAgent(agentId);

    const existingConversation = conversations.get(threadId);
    if (!existingConversation) {
      await logNewConversation(threadId, agentId, userInput.message, metadata);
    } else {
      await logResumeConversation(threadId, agentId, userInput.message, existingConversation.messages.length, metadata);
    }

    await logMessageSent(threadId, agentId, userInput.message, metadata);

    addMessageToConversation(threadId, {
      type: 'human',
      content: userInput.message,
      timestamp: new Date().toISOString()
    });

    const config: RunnableConfig = {
      configurable: { thread_id: threadId },
      runId: runId
    };

    const input = { messages: [new HumanMessage({ content: userInput.message })] };
    const result = await agent.invoke(input, config);

    const lastMessage = result.messages[result.messages.length - 1];
    const responseContent = lastMessage?.content || 'Aucune réponse';

    await logMessageReceived(threadId, agentId, responseContent.toString(), metadata);

    addMessageToConversation(threadId, {
      type: 'ai',
      content: responseContent.toString(),
      timestamp: new Date().toISOString()
    });

    const agentResponse: AgentResponse = {
      content: responseContent.toString(),
      thread_id: threadId,
      run_id: runId
    };

    res.json(agentResponse);
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'invocation:', error);
    
    const threadId = userInput.thread_id || 'unknown';
    const metadata = extractRequestMetadata(req);
    await logError(threadId, agentId, error as Error, 'invoke', metadata);
    
    res.status(500).json({
      error: 'Erreur lors de l\'invocation de l\'agent',
      message: (error as Error).message
    });
  }
});

app.post('/:agentId/stream', authenticateToken, async (req: Request, res: Response) => {
  const { agentId } = req.params;
  const userInput: UserInput = req.body;
  
  try {
    const threadId = userInput.thread_id || uuidv4();
    const runId = uuidv4();
    const metadata = extractRequestMetadata(req);
    
    const agent = getAgent(agentId);

    const existingConversation = conversations.get(threadId);
    if (!existingConversation) {
      await logNewConversation(threadId, agentId, userInput.message, metadata);
    } else {
      await logResumeConversation(threadId, agentId, userInput.message, existingConversation.messages.length, metadata);
    }

    await logMessageSent(threadId, agentId, userInput.message, metadata);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    activeGenerations.set(threadId, true);

    const sendSSE = (event: string, data?: any) => {
      res.write(`event: ${event}\n`);
      if (data !== undefined) {
        res.write(`data: ${JSON.stringify(data)}\n`);
      }
      res.write('\n');
    };

    addMessageToConversation(threadId, {
      type: 'human',
      content: userInput.message,
      timestamp: new Date().toISOString()
    });

    sendSSE('stream_start');

    try {
      const config: RunnableConfig = {
        configurable: { thread_id: threadId },
        runId: runId
      };

      const input = { messages: [new HumanMessage({ content: userInput.message })] };
      let fullResponse = '';

      try {
        const stream = await agent.stream(input, config);
        
        for await (const chunk of stream) {
          if (!activeGenerations.get(threadId)) {
            break;
          }
          
          for (const [nodeName, nodeData] of Object.entries(chunk)) {
            if (nodeName === '__start__') continue;
            
            if (nodeData && typeof nodeData === 'object' && 'messages' in nodeData) {
              const messages = (nodeData as any).messages || [];
              
              for (const message of messages) {
                if (message.tool_calls && Array.isArray(message.tool_calls)) {
                  for (const toolCall of message.tool_calls) {
                    sendSSE('tool_execution_start', {
                      name: toolCall.name,
                      params: toolCall.args || {},
                      id: toolCall.id
                    });
                  }
                }
                
                if (message.tool_call_id && message.content) {
                  const toolName = message.name || 'tool';
                  const toolResult = message.content;
                  
                  await logToolExecution(threadId, agentId, toolName, {}, toolResult, metadata);
                  
                  sendSSE('tool_execution_complete', {
                    name: toolName,
                    output: toolResult,
                    id: message.tool_call_id
                  });
                }
                
                if (message.content && !message.tool_call_id && nodeName === 'agent') {
                  const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
                  fullResponse += content;
                  
                  const chunks = content.match(/.{1,10}/g) || [content];
                  for (const textChunk of chunks) {
                    sendSSE('stream_token', { token: textChunk });
                    await new Promise(resolve => setTimeout(resolve, 20));
                  }
                }
              }
            }
          }
        }
      } catch (streamError) {
        console.error('❌ Erreur pendant le streaming de l\'agent:', streamError);
        
        await logError(threadId, agentId, streamError as Error, 'stream', metadata);
        
        sendSSE('tool_execution_error', {
          name: 'agent_stream',
          error: (streamError as Error).message
        });
        fullResponse = `Erreur lors du traitement de votre demande: ${(streamError as Error).message}`;
        sendSSE('stream_token', { token: fullResponse });
      }

      if (fullResponse) {
        await logMessageReceived(threadId, agentId, fullResponse, metadata);
      }

      if (fullResponse) {
        addMessageToConversation(threadId, {
          type: 'ai',
          content: fullResponse,
          timestamp: new Date().toISOString()
        });
      }

      sendSSE('stream_end', { thread_id: threadId });
      
    } catch (error) {
      console.error('❌ Erreur pendant le streaming:', error);
      
      await logError(threadId, agentId, error as Error, 'stream', metadata);
      
      sendSSE('error', (error as Error).message);
    } finally {
      activeGenerations.delete(threadId);
      res.end();
    }

    req.on('close', () => {
      console.log(`🔌 Client déconnecté pour le thread ${threadId}`);
      activeGenerations.set(threadId, false);
    });
    
  } catch (error) {
    console.error('❌ Erreur lors du streaming:', error);
    
    const threadId = userInput.thread_id || 'unknown';
    const metadata = extractRequestMetadata(req);
    await logError(threadId, agentId, error as Error, 'stream', metadata);
    
    res.status(500).json({
      error: 'Erreur lors du streaming avec l\'agent',
      message: (error as Error).message
    });
  }
});

app.post('/:agentId/stop', authenticateToken, async (req: Request, res: Response) => {
  const { agentId } = req.params;
  const { thread_id } = req.body;
  
  try {
    console.log(`🛑 Arrêt de la génération pour l'agent ${agentId}, thread ${thread_id}`);
    
    if (thread_id && activeGenerations.has(thread_id)) {
      activeGenerations.set(thread_id, false);
      setTimeout(() => activeGenerations.delete(thread_id), 1000);
      
      res.json({
        status: 'success',
        message: 'Génération arrêtée avec succès'
      });
    } else {
      res.json({
        status: 'success',
        message: 'Aucune génération active à arrêter'
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'arrêt:', error);
    res.status(500).json({
      error: 'Erreur lors de l\'arrêt de la génération',
      message: (error as Error).message
    });
  }
});

app.get('/conversations/:threadId', authenticateToken, async (req: Request, res: Response) => {
  const { threadId } = req.params;
  
  try {
    const conversation = conversations.get(threadId);
    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation non trouvée',
        message: `Aucune conversation trouvée pour le thread ${threadId}`
      });
    }
    
    res.json(conversation);
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération de la conversation:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération de la conversation',
      message: (error as Error).message
    });
  }
});

app.get('/conversations', authenticateToken, async (req: Request, res: Response) => {
  try {
    const conversationList = Array.from(conversations.values()).map(conv => ({
      thread_id: conv.thread_id,
      message_count: conv.messages.length,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      last_message: conv.messages[conv.messages.length - 1]?.content.slice(0, 100) || 'Aucun message'
    }));
    
    res.json(conversationList);
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des conversations:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des conversations',
      message: (error as Error).message
    });
  }
});

app.use(errorHandler);

app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route non trouvée',
    message: `La route ${req.path} n'existe pas`,
    available_endpoints: [
      'GET /health',
      'GET /agents',
      'POST /:agentId/invoke',
      'POST /:agentId/stream',
      'POST /:agentId/stop',
      'GET /conversations',
      'GET /conversations/:threadId'
    ]
  });
});

async function startServer() {
  try {
    app.listen(PORT, () => {
      console.log('🚀 Serveur Agent CLI démarré !');
      console.log(`📡 Port: ${PORT}`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/health`);
      console.log(`🤖 Agents: http://localhost:${PORT}/agents`);
      console.log('');
      console.log('📚 Endpoints disponibles:');
      console.log('  GET  /health                     - Vérification de santé');
      console.log('  GET  /agents                     - Liste des agents');
      console.log('  POST /:agentId/invoke            - Invocation directe');
      console.log('  POST /:agentId/stream            - Streaming SSE');
      console.log('  POST /:agentId/stop              - Arrêter la génération');
      console.log('  GET  /conversations              - Liste des conversations');
      console.log('  GET  /conversations/:threadId    - Détails d\'une conversation');
      console.log('');
      console.log('🔑 Variables d\'environnement:');
      console.log(`  PORT=${PORT}`);
      console.log(`  REQUIRE_AUTH=${process.env.REQUIRE_AUTH || 'true'}`);
      console.log('');
      console.log('💡 Pour tester avec le CLI:');
      console.log('  npm run cli check');
      console.log('  npm run cli chat');
      
      loadAgentsConfig().then(agents => {
        console.log('');
        console.log('🤖 Agents disponibles:');
        agents.forEach(agent => {
          console.log(`  - ${agent.id}: ${agent.name}`);
          console.log(`    ${agent.description}`);
        });
      });
    });
  } catch (error) {
    console.error('❌ Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  console.log('🛑 Arrêt du serveur...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Arrêt du serveur...');
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export default app; 