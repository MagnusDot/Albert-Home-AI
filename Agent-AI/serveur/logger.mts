import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ConversationLog {
  id: string;
  thread_id: string;
  agent_id: string;
  event_type: 'new_conversation' | 'resume_conversation' | 'message_sent' | 'message_received' | 'tool_execution' | 'error';
  timestamp: string;
  details: {
    user_message?: string;
    ai_response?: string;
    tool_name?: string;
    tool_params?: any;
    tool_result?: any;
    error_message?: string;
    message_count?: number;
    session_duration?: number;
  };
  metadata: {
    user_agent?: string;
    ip_address?: string;
    session_id?: string;
  };
}

export interface LogConfig {
  enabled: boolean;
  log_level: 'debug' | 'info' | 'warn' | 'error';
  log_directory: string;
  max_file_size: number;
  max_files: number;
  include_metadata: boolean;
}

const defaultConfig: LogConfig = {
  enabled: process.env.LOGGING_ENABLED !== 'false',
  log_level: (process.env.LOG_LEVEL as any) || 'info',
  log_directory: process.env.LOG_DIRECTORY || path.join(__dirname, '../logs'),
  max_file_size: parseInt(process.env.LOG_MAX_FILE_SIZE || '10'),
  max_files: parseInt(process.env.LOG_MAX_FILES || '5'),
  include_metadata: process.env.LOG_INCLUDE_METADATA !== 'false'
};

class ConversationLogger {
  private config: LogConfig;
  private logQueue: ConversationLog[] = [];
  private isProcessing = false;

  constructor(config: Partial<LogConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.ensureLogDirectory();
  }

  private async ensureLogDirectory(): Promise<void> {
    if (!this.config.enabled) return;
    
    try {
      await fs.mkdir(this.config.log_directory, { recursive: true });
      console.log(`📁 Répertoire de logs créé: ${this.config.log_directory}`);
    } catch (error) {
      console.error('❌ Erreur lors de la création du répertoire de logs:', error);
    }
  }

  private getLogFileName(date: Date = new Date()): string {
    const dateStr = date.toISOString().split('T')[0];
    return `conversations-${dateStr}.jsonl`;
  }

  private getLogFilePath(date: Date = new Date()): string {
    return path.join(this.config.log_directory, this.getLogFileName(date));
  }

  private shouldLog(level: string): boolean {
    if (!this.config.enabled) return false;
    
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level as keyof typeof levels] >= levels[this.config.log_level];
  }

  private async writeLog(log: ConversationLog): Promise<void> {
    if (!this.shouldLog('info')) return;

    try {
      const logLine = JSON.stringify(log) + '\n';
      const logFile = this.getLogFilePath(new Date(log.timestamp));
      
      await fs.appendFile(logFile, logLine, 'utf8');
    } catch (error) {
      console.error('❌ Erreur lors de l\'écriture du log:', error);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.logQueue.length === 0) return;
    
    this.isProcessing = true;
    
    try {
      const logs = [...this.logQueue];
      this.logQueue = [];
      
      for (const log of logs) {
        await this.writeLog(log);
      }
    } catch (error) {
      console.error('❌ Erreur lors du traitement de la queue de logs:', error);
    } finally {
      this.isProcessing = false;
      
      if (this.logQueue.length > 0) {
        setTimeout(() => this.processQueue(), 100);
      }
    }
  }

  async logNewConversation(
    threadId: string,
    agentId: string,
    userMessage: string,
    metadata?: Partial<ConversationLog['metadata']>
  ): Promise<void> {
    const log: ConversationLog = {
      id: crypto.randomUUID(),
      thread_id: threadId,
      agent_id: agentId,
      event_type: 'new_conversation',
      timestamp: new Date().toISOString(),
      details: {
        user_message: userMessage,
        message_count: 1
      },
      metadata: {
        ...metadata,
        session_id: crypto.randomUUID()
      }
    };

    this.logQueue.push(log);
    this.processQueue();
    
    console.log(`🆕 Nouvelle conversation démarrée - Thread: ${threadId}, Agent: ${agentId}`);
  }

  async logResumeConversation(
    threadId: string,
    agentId: string,
    userMessage: string,
    messageCount: number,
    metadata?: Partial<ConversationLog['metadata']>
  ): Promise<void> {
    const log: ConversationLog = {
      id: crypto.randomUUID(),
      thread_id: threadId,
      agent_id: agentId,
      event_type: 'resume_conversation',
      timestamp: new Date().toISOString(),
      details: {
        user_message: userMessage,
        message_count: messageCount
      },
      metadata: {
        ...metadata,
        session_id: crypto.randomUUID()
      }
    };

    this.logQueue.push(log);
    this.processQueue();
    
    console.log(`🔄 Conversation reprise - Thread: ${threadId}, Agent: ${agentId}, Messages: ${messageCount}`);
  }

  async logMessageSent(
    threadId: string,
    agentId: string,
    message: string,
    metadata?: Partial<ConversationLog['metadata']>
  ): Promise<void> {
    const log: ConversationLog = {
      id: crypto.randomUUID(),
      thread_id: threadId,
      agent_id: agentId,
      event_type: 'message_sent',
      timestamp: new Date().toISOString(),
      details: {
        user_message: message
      },
      metadata: metadata || {}
    };

    this.logQueue.push(log);
    this.processQueue();
  }

  async logMessageReceived(
    threadId: string,
    agentId: string,
    response: string,
    metadata?: Partial<ConversationLog['metadata']>
  ): Promise<void> {
    const log: ConversationLog = {
      id: crypto.randomUUID(),
      thread_id: threadId,
      agent_id: agentId,
      event_type: 'message_received',
      timestamp: new Date().toISOString(),
      details: {
        ai_response: response
      },
      metadata: metadata || {}
    };

    this.logQueue.push(log);
    this.processQueue();
  }

  async logToolExecution(
    threadId: string,
    agentId: string,
    toolName: string,
    toolParams: any,
    toolResult: any,
    metadata?: Partial<ConversationLog['metadata']>
  ): Promise<void> {
    const log: ConversationLog = {
      id: crypto.randomUUID(),
      thread_id: threadId,
      agent_id: agentId,
      event_type: 'tool_execution',
      timestamp: new Date().toISOString(),
      details: {
        tool_name: toolName,
        tool_params: toolParams,
        tool_result: toolResult
      },
      metadata: metadata || {}
    };

    this.logQueue.push(log);
    this.processQueue();
    
    console.log(`🔧 Outil exécuté - Thread: ${threadId}, Outil: ${toolName}`);
  }

  async logError(
    threadId: string,
    agentId: string,
    error: Error,
    context?: string,
    metadata?: Partial<ConversationLog['metadata']>
  ): Promise<void> {
    const log: ConversationLog = {
      id: crypto.randomUUID(),
      thread_id: threadId,
      agent_id: agentId,
      event_type: 'error',
      timestamp: new Date().toISOString(),
      details: {
        error_message: error.message,
        tool_name: context
      },
      metadata: metadata || {}
    };

    this.logQueue.push(log);
    this.processQueue();
    
    console.error(`❌ Erreur dans la conversation - Thread: ${threadId}, Erreur: ${error.message}`);
  }

  async getLogsByThreadId(threadId: string, limit: number = 100): Promise<ConversationLog[]> {
    if (!this.config.enabled) return [];

    try {
      const logs: ConversationLog[] = [];
      const files = await fs.readdir(this.config.log_directory);
      const logFiles = files.filter(file => file.startsWith('conversations-') && file.endsWith('.jsonl'));
      
      logFiles.sort().reverse();
      
      for (const file of logFiles) {
        if (logs.length >= limit) break;
        
        const filePath = path.join(this.config.log_directory, file);
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          if (logs.length >= limit) break;
          
          try {
            const log: ConversationLog = JSON.parse(line);
            if (log.thread_id === threadId) {
              logs.push(log);
            }
          } catch (parseError) {
            console.warn('⚠️ Erreur lors du parsing d\'une ligne de log:', parseError);
          }
        }
      }
      
      return logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des logs:', error);
      return [];
    }
  }

  async getLogsByDate(date: string, limit: number = 100): Promise<ConversationLog[]> {
    if (!this.config.enabled) return [];

    try {
      const logs: ConversationLog[] = [];
      const filePath = this.getLogFilePath(new Date(date));
      
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          if (logs.length >= limit) break;
          
          try {
            const log: ConversationLog = JSON.parse(line);
            logs.push(log);
          } catch (parseError) {
            console.warn('⚠️ Erreur lors du parsing d\'une ligne de log:', parseError);
          }
        }
      } catch (fileError) {
        return [];
      }
      
      return logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des logs par date:', error);
      return [];
    }
  }

  async getLogStats(): Promise<{
    total_conversations: number;
    total_messages: number;
    total_errors: number;
    date_range: { start: string; end: string };
  }> {
    if (!this.config.enabled) {
      return {
        total_conversations: 0,
        total_messages: 0,
        total_errors: 0,
        date_range: { start: '', end: '' }
      };
    }

    try {
      const files = await fs.readdir(this.config.log_directory);
      const logFiles = files.filter(file => file.startsWith('conversations-') && file.endsWith('.jsonl'));
      
      let totalConversations = 0;
      let totalMessages = 0;
      let totalErrors = 0;
      let startDate = '';
      let endDate = '';
      
      for (const file of logFiles) {
        const filePath = path.join(this.config.log_directory, file);
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const log: ConversationLog = JSON.parse(line);
            
            if (log.event_type === 'new_conversation') totalConversations++;
            if (log.event_type === 'message_sent' || log.event_type === 'message_received') totalMessages++;
            if (log.event_type === 'error') totalErrors++;
            
            if (!startDate || log.timestamp < startDate) startDate = log.timestamp;
            if (!endDate || log.timestamp > endDate) endDate = log.timestamp;
          } catch (parseError) {
          }
        }
      }
      
      return {
        total_conversations: totalConversations,
        total_messages: totalMessages,
        total_errors: totalErrors,
        date_range: { start: startDate, end: endDate }
      };
    } catch (error) {
      console.error('❌ Erreur lors du calcul des statistiques:', error);
      return {
        total_conversations: 0,
        total_messages: 0,
        total_errors: 0,
        date_range: { start: '', end: '' }
      };
    }
  }
}

export const conversationLogger = new ConversationLogger();

export const logNewConversation = conversationLogger.logNewConversation.bind(conversationLogger);
export const logResumeConversation = conversationLogger.logResumeConversation.bind(conversationLogger);
export const logMessageSent = conversationLogger.logMessageSent.bind(conversationLogger);
export const logMessageReceived = conversationLogger.logMessageReceived.bind(conversationLogger);
export const logToolExecution = conversationLogger.logToolExecution.bind(conversationLogger);
export const logError = conversationLogger.logError.bind(conversationLogger);
export const getLogsByThreadId = conversationLogger.getLogsByThreadId.bind(conversationLogger);
export const getLogsByDate = conversationLogger.getLogsByDate.bind(conversationLogger);
export const getLogStats = conversationLogger.getLogStats.bind(conversationLogger); 