import { tool } from "@langchain/core/tools";
import { spawn } from "child_process";
import { z } from "zod";
import { agentModel } from "../model.mts";

// Configuration des MCP disponibles
const availableMCP = [
  {
    name: "wikipedia-mcp",
    command: "docker",
    args: [
      "run",
      "-i",
      "--rm",
      "mcp/wikipedia-mcp"
    ],
    description: "Serveur MCP pour interroger Wikipedia via docker (image mcp/wikipedia-mcp)"
  },
  {
    name: "filesystem",
    command: "npx",
    args: ["@modelcontextprotocol/server-filesystem", process.cwd()],
    description: "Serveur MCP pour les opérations de fichiers locaux"
  }
];

interface MCPTool {
  name: string;
  description?: string;
  inputSchema: any;
}

// Cache des connexions MCP actives
const mcpCache: Map<string, { client: MCPClient; tools: MCPTool[] }> = new Map();

// Fonction d'analyse intelligente du contexte
async function analyzeContextWithAI(userMessage: string, availableTools: MCPTool[]): Promise<{ toolName: string; args: any } | null> {
  try {
    const toolsDescription = availableTools.map(tool => 
      `- ${tool.name}: ${tool.description || 'Pas de description'}
      Schema: ${JSON.stringify(tool.inputSchema, null, 2)}`
    ).join('\n');

    const prompt = `Tu es un expert en analyse de contexte pour les outils MCP. 

Message utilisateur: "${userMessage}"

Répertoire de travail actuel: ${process.cwd()}

Outils MCP disponibles:
${toolsDescription}

Analyse ce message et détermine:
1. Quel outil utiliser (nom exact de l'outil)
2. Quels arguments passer (respecte exactement le schema JSON)

Réponds UNIQUEMENT avec un JSON valide dans ce format:
{
  "toolName": "nom_exact_de_l_outil",
  "args": {
    "parametre1": "valeur1",
    "parametre2": "valeur2"
  }
}

Si tu ne peux pas déterminer l'outil ou les arguments, réponds: null`;

    const response = await agentModel.invoke(prompt);
    const content = response.content.toString().trim();
    
    // Debug supprimé
    
    const cleanContent = content.replace(/```json\n?|```\n?/g, '').trim();
    
    if (cleanContent === 'null') {
      return null;
    }
    
    return JSON.parse(cleanContent);
  } catch (error) {
    console.error('❌ Erreur analyse IA:', error);
    return null;
  }
}

// Client MCP simplifié
class MCPClient {
  private serverProcess: any;
  private messageId = 0;
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();

  async connect(command: string, args: string[] = []) {
    try {
      this.serverProcess = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env
      });

      if (!this.serverProcess) {
        throw new Error(`Impossible de lancer le serveur MCP: ${command}`);
      }

      this.serverProcess.stdout?.setEncoding('utf8');
      this.serverProcess.stderr?.setEncoding('utf8');

      this.serverProcess.stdout?.on('data', (data: string) => {
        this.handleMessage(data);
      });

      this.serverProcess.stderr?.on('data', (data: string) => {
        console.error(`Erreur serveur MCP:`, data);
      });

      // Initialisation MCP
      const initResponse = await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'agent-mcp-client', version: '1.0.0' }
      });

      if (initResponse.error) {
        throw new Error(`Erreur d'initialisation MCP: ${initResponse.error.message}`);
      }

      await this.sendNotification('notifications/initialized', {});
      return true;
    } catch (error) {
      console.error(`Erreur de connexion MCP:`, error);
      throw error;
    }
  }

  async listTools(): Promise<MCPTool[]> {
    try {
      const response = await this.sendRequest('tools/list', {});
      return response.result?.tools || [];
    } catch (error) {
      console.error('Erreur lors de la récupération des outils MCP:', error);
      return [];
    }
  }

  async callTool(name: string, arguments_: any): Promise<any> {
    try {
      const response = await this.sendRequest('tools/call', {
        name,
        arguments: arguments_
      });

      if (response.error) {
        throw new Error(`Erreur d'exécution de l'outil ${name}: ${response.error.message}`);
      }

      return response.result;
    } catch (error) {
      console.error(`Erreur lors de l'appel de l'outil ${name}:`, error);
      throw error;
    }
  }

  private async sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      const message = { jsonrpc: '2.0', id, method, params };

      this.pendingRequests.set(id, { resolve, reject });

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Timeout pour la requête ${method}`));
        }
      }, 30000);

      this.serverProcess.stdin?.write(JSON.stringify(message) + '\n');
    });
  }

  private async sendNotification(method: string, params: any): Promise<void> {
    const message = { jsonrpc: '2.0', method, params };
    this.serverProcess.stdin?.write(JSON.stringify(message) + '\n');
  }

  private handleMessage(data: string) {
    const lines = data.trim().split('\n');
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const message = JSON.parse(line);
        
        if (message.id && this.pendingRequests.has(message.id)) {
          const { resolve } = this.pendingRequests.get(message.id)!;
          this.pendingRequests.delete(message.id);
          resolve(message);
        }
      } catch (error) {
        console.error('Erreur de parsing du message MCP:', error);
      }
    }
  }

  async disconnect() {
    if (this.serverProcess) {
      this.serverProcess.kill();
    }
    this.pendingRequests.clear();
  }
}

// Fonction fallback pour sélectionner un outil
function selectToolForMessage(tools: MCPTool[], message: string): { tool: MCPTool; args: any } | null {
  if (tools.length === 0) return null;
  
  const messageLower = message.toLowerCase();
  
  // Chercher un outil correspondant
  for (const tool of tools) {
    const toolName = tool.name.toLowerCase();
    if (messageLower.includes(toolName)) {
      return { tool, args: extractBasicArgs(message, tool) };
    }
  }
  
  // Par défaut, utiliser le premier outil
  return { tool: tools[0], args: extractBasicArgs(message, tools[0]) };
}

// Extraction basique d'arguments
function extractBasicArgs(message: string, tool: MCPTool): any {
  const args: any = {};
  
  // Extraire les chemins de fichiers
  const pathMatch = message.match(/['""]([^'""]+)['""]/) || message.match(/(\S+\.\w+)/);
  if (pathMatch) {
    const path = pathMatch[1] || pathMatch[0];
    if (tool.inputSchema?.properties?.path) args.path = path;
    if (tool.inputSchema?.properties?.file) args.file = path;
    if (tool.inputSchema?.properties?.filename) args.filename = path;
  }
  
  // Pour echo
  if (tool.name === 'echo' && tool.inputSchema?.properties?.message) {
    const echoMatch = message.match(/echo\s+(.+)/i);
    args.message = echoMatch ? echoMatch[1] : message;
  }
  
  return args;
}

export const mcpClient = tool(
  async ({ mcpLink, message }) => {
    try {
      // Analyser le lien MCP
      let mcpConfig = availableMCP.find(mcp => 
        mcpLink.toLowerCase().includes(mcp.name) || mcpLink === mcp.name
      );
      
      if (!mcpConfig) {
        if (mcpLink.startsWith('npx ') || mcpLink.startsWith('docker ')) {
          const parts = mcpLink.split(' ');
          mcpConfig = {
            name: parts[1] || 'custom',
            command: parts[0],
            args: parts.slice(1),
            description: 'Serveur MCP custom'
          };
        } else {
          return `❌ Format de lien MCP non reconnu. Utilisez soit un nom (wikipedia-mcp, filesystem, git, sqlite, time, echo) soit une commande commençant par 'npx ' ou 'docker '`;
        }
      }
      
      const cacheKey = `${mcpConfig.command}_${mcpConfig.args?.join('_')}`;
      
      // Vérifier le cache
      let cachedConnection = mcpCache.get(cacheKey);
      
      if (!cachedConnection) {
        console.log(`🔌 Connexion au serveur MCP: ${mcpConfig.name}`);
        
        const client = new MCPClient();
        await client.connect(mcpConfig.command, mcpConfig.args || []);
        
        const tools = await client.listTools();
        
        cachedConnection = { client, tools };
        mcpCache.set(cacheKey, cachedConnection);
        
        console.log(`✅ Connecté à ${mcpConfig.name} avec ${tools.length} outils`);
      }
      
      const { client, tools } = cachedConnection;
      
      if (tools.length === 0) {
        // Tentative d'appel direct selon le type de serveur MCP
        if (mcpConfig.name === 'wikipedia-mcp') {
          let query = message;
          let lang = 'fr';
          if (/\ben\b|anglais/i.test(message)) lang = 'en';
          if (/\bes\b|espagnol/i.test(message)) lang = 'es';
          if (/\bde\b|allemand/i.test(message)) lang = 'de';
          query = query.replace(/(sur wikipedia|wikipédia|en anglais|en français|en espagnol|en allemand)/gi, '').trim();
          try {
            const result = await client.callTool('wikipedia_search', { query, lang });
            if (result && result.content) {
              return `✅ Résultat Wikipedia (${lang}):\n${typeof result.content === 'string' ? result.content : JSON.stringify(result.content, null, 2)}`;
            }
            return `❌ Aucun résultat Wikipedia trouvé.`;
          } catch (err: any) {
            return `❌ Erreur lors de l'appel direct à wikipedia_search: ${err.message}`;
          }
        }
        
        // Filesystem
        if (mcpConfig.name === 'filesystem') {
          const messageLower = message.toLowerCase();
          try {
            const fileMatch = message.match(/['""]([^'""]+)['""]/) || message.match(/(\S+\.\w+)/);
            const filename = fileMatch ? fileMatch[1] || fileMatch[0] : 'README.md';
            
            if (messageLower.includes('lire') || messageLower.includes('read') || messageLower.includes('contenu')) {
              const result = await client.callTool('read_file', { path: filename });
              if (result && result.content) {
                return `✅ Contenu du fichier ${filename}:\n${typeof result.content === 'string' ? result.content : JSON.stringify(result.content, null, 2)}`;
              }
            } else if (messageLower.includes('écrire') || messageLower.includes('write') || messageLower.includes('créer')) {
              const contentMatch = message.match(/contenu[:\s]+['"]([^'"]+)['"]/i) || message.match(/avec le contenu\s+['"]([^'"]+)['"]/i);
              const content = contentMatch ? contentMatch[1] : 'Contenu de test';
              const result = await client.callTool('write_file', { path: filename, content });
              return `✅ Fichier ${filename} écrit avec succès.`;
            } else if (messageLower.includes('liste') || messageLower.includes('list')) {
              const result = await client.callTool('list_directory', { path: '.' });
              if (result && result.content) {
                return `✅ Contenu du répertoire:\n${typeof result.content === 'string' ? result.content : JSON.stringify(result.content, null, 2)}`;
              }
            }
          } catch (err: any) {
            return `❌ Erreur filesystem: ${err.message}`;
          }
        }
        
        // Git
        if (mcpConfig.name === 'git') {
          const messageLower = message.toLowerCase();
          try {
            if (messageLower.includes('status') || messageLower.includes('statut')) {
              const result = await client.callTool('git_status', {});
              if (result && result.content) {
                return `✅ Statut Git:\n${typeof result.content === 'string' ? result.content : JSON.stringify(result.content, null, 2)}`;
              }
            } else if (messageLower.includes('log') || messageLower.includes('historique')) {
              const result = await client.callTool('git_log', { max_count: 10 });
              if (result && result.content) {
                return `✅ Historique Git:\n${typeof result.content === 'string' ? result.content : JSON.stringify(result.content, null, 2)}`;
              }
            } else if (messageLower.includes('diff')) {
              const result = await client.callTool('git_diff', {});
              if (result && result.content) {
                return `✅ Différences Git:\n${typeof result.content === 'string' ? result.content : JSON.stringify(result.content, null, 2)}`;
              }
            }
          } catch (err: any) {
            return `❌ Erreur Git: ${err.message}`;
          }
        }
        
        // Time
        if (mcpConfig.name === 'time') {
          try {
            const timezoneMatch = message.match(/fuseau\s+([^\s]+)|timezone\s+([^\s]+)|à\s+([A-Za-z]+)/i);
            const timezone = timezoneMatch ? (timezoneMatch[1] || timezoneMatch[2] || timezoneMatch[3]) : 'UTC';
            
            const result = await client.callTool('get_current_time', { timezone });
            if (result && result.content) {
              return `✅ Heure actuelle (${timezone}):\n${typeof result.content === 'string' ? result.content : JSON.stringify(result.content, null, 2)}`;
            }
          } catch (err: any) {
            return `❌ Erreur Time: ${err.message}`;
          }
        }
        
        // SQLite
        if (mcpConfig.name === 'sqlite') {
          try {
            const messageLower = message.toLowerCase();
            if (messageLower.includes('table') || messageLower.includes('créer')) {
              const result = await client.callTool('execute_query', { 
                query: "CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT)" 
              });
              return `✅ Table créée avec succès.`;
            } else if (messageLower.includes('select') || messageLower.includes('requête')) {
              const sqlMatch = message.match(/(?:requête|query|sql)[:\s]+(.+)/i);
              const query = sqlMatch ? sqlMatch[1] : "SELECT name FROM sqlite_master WHERE type='table'";
              const result = await client.callTool('execute_query', { query });
              if (result && result.content) {
                return `✅ Résultat SQLite:\n${typeof result.content === 'string' ? result.content : JSON.stringify(result.content, null, 2)}`;
              }
            }
          } catch (err: any) {
            return `❌ Erreur SQLite: ${err.message}`;
          }
        }
        
        // Echo
        if (mcpConfig.name === 'echo') {
          try {
            const echoMatch = message.match(/echo\s+(.+)/i);
            const text = echoMatch ? echoMatch[1] : message;
            const result = await client.callTool('echo', { message: text });
            if (result && result.content) {
              return `✅ Echo:\n${typeof result.content === 'string' ? result.content : JSON.stringify(result.content, null, 2)}`;
            }
          } catch (err: any) {
            return `❌ Erreur Echo: ${err.message}`;
          }
        }
        
        return `⚠️ Aucun outil disponible sur le serveur MCP '${mcpConfig.name}'`;
      }
      
      // Analyse IA du contexte
      console.log('🤖 Analyse du contexte avec IA...');
      const aiAnalysis = await analyzeContextWithAI(message, tools);
      
      let selection: { tool: MCPTool; args: any } | null = null;
      
      if (aiAnalysis) {
        const aiTool = tools.find(t => t.name === aiAnalysis.toolName);
        if (aiTool) {
          selection = { tool: aiTool, args: aiAnalysis.args };
          console.log('🎯 IA a sélectionné:', aiAnalysis.toolName);
        }
      }
      
      // Fallback si l'IA échoue
      if (!selection) {
        console.log('🔄 Fallback sur logique basique...');
        selection = selectToolForMessage(tools, message);
      }
      
      if (!selection) {
        return `❌ Impossible de déterminer l'outil approprié pour: "${message}"\n🔧 Outils disponibles: ${tools.map(t => t.name).join(', ')}`;
      }
      
      const { tool, args } = selection;
      console.log(`🔧 Exécution de l'outil: ${tool.name}`);
      
      // Exécuter l'outil
      const result = await client.callTool(tool.name, args);
      
      // Formater la réponse
      if (result.content) {
        if (Array.isArray(result.content)) {
          const textContent = result.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join('\n');
          return `✅ Résultat de '${tool.name}':\n${textContent}`;
        } else if (typeof result.content === 'string') {
          return `✅ Résultat de '${tool.name}':\n${result.content}`;
        }
      }
      
      return `✅ Résultat de '${tool.name}':\n${JSON.stringify(result, null, 2)}`;
      
    } catch (error: any) {
      console.error('Erreur MCP Client:', error);
      return `❌ Erreur lors de l'exécution MCP: ${error.message}`;
    }
  },
  {
    name: "mcp_client",
    description: "Client MCP intelligent qui utilise l'IA pour analyser le contexte et se connecter automatiquement aux serveurs MCP appropriés",
    schema: z.object({
      mcpLink: z.string()
        .describe("Nom ou lien du serveur MCP (ex: 'wikipedia-mcp', 'filesystem', 'git', 'sqlite', 'time', 'echo')"),
      message: z.string()
        .describe("Message décrivant ce que vous voulez faire (ex: 'lire le fichier test.txt', 'chercher dans la base de données')")
    }),
  }
);

export const listMcpServers = tool(
  async () => {
    return JSON.stringify(
      availableMCP.map(({ name, command, args, description }) => ({ name, command, args, description })),
      null,
      2
    );
  },
  {
    name: "list_mcp_servers",
    description: "Liste les serveurs MCP disponibles (nom, commande, arguments, description)",
    schema: z.object({})
  }
);

// Fonction pour convertir un schéma JSON en champs de formulaire
function convertSchemaToFormFields(schema: any): any[] {
  const fields: any[] = [];
  
  if (!schema || !schema.properties) {
    return fields;
  }
  
  Object.entries(schema.properties).forEach(([key, value]: [string, any]) => {
    const field: any = {
      name: key,
      label: value.title || key.charAt(0).toUpperCase() + key.slice(1),
      description: value.description || '',
      required: schema.required?.includes(key) || false
    };
    
    // Déterminer le type de champ selon le type JSON Schema
    switch (value.type) {
      case 'string':
        if (value.enum) {
          field.type = 'select';
          field.options = value.enum.map((option: string) => ({
            value: option,
            label: option
          }));
        } else if (value.format === 'date') {
          field.type = 'date';
        } else if (value.format === 'email') {
          field.type = 'email';
        } else if (value.format === 'uri') {
          field.type = 'url';
        } else if (value.maxLength && value.maxLength > 100) {
          field.type = 'textarea';
        } else {
          field.type = 'text';
        }
        break;
      case 'number':
      case 'integer':
        field.type = 'number';
        if (value.minimum !== undefined) field.min = value.minimum;
        if (value.maximum !== undefined) field.max = value.maximum;
        break;
      case 'boolean':
        field.type = 'checkbox';
        break;
      case 'array':
        field.type = 'array';
        field.itemType = value.items?.type || 'string';
        break;
      case 'object':
        field.type = 'object';
        field.properties = convertSchemaToFormFields(value);
        break;
      default:
        field.type = 'text';
    }
    
    // Ajouter des validations
    if (value.pattern) field.pattern = value.pattern;
    if (value.minLength !== undefined) field.minLength = value.minLength;
    if (value.maxLength !== undefined) field.maxLength = value.maxLength;
    if (value.default !== undefined) field.defaultValue = value.default;
    
    fields.push(field);
  });
  
  return fields;
}

export const getMcpToolSchemas = tool(
  async ({ mcpServerName, userQuery }) => {
    try {
      // Trouver la configuration MCP
      const mcpConfig = availableMCP.find(mcp => 
        mcp.name === mcpServerName || mcpServerName.toLowerCase().includes(mcp.name)
      );
      
      if (!mcpConfig) {
        return JSON.stringify({
          error: `Serveur MCP '${mcpServerName}' non trouvé`,
          availableServers: availableMCP.map(mcp => mcp.name)
        });
      }
      
      const cacheKey = `${mcpConfig.command}_${mcpConfig.args?.join('_')}`;
      
      // Vérifier le cache ou créer une nouvelle connexion
      let cachedConnection = mcpCache.get(cacheKey);
      
      if (!cachedConnection) {
        console.log(`🔌 Connexion au serveur MCP: ${mcpConfig.name}`);
        
        const client = new MCPClient();
        await client.connect(mcpConfig.command, mcpConfig.args || []);
        
        const tools = await client.listTools();
        
        cachedConnection = { client, tools };
        mcpCache.set(cacheKey, cachedConnection);
        
        console.log(`✅ Connecté à ${mcpConfig.name} avec ${tools.length} outils`);
      }
      
      const { tools } = cachedConnection;
      
      if (tools.length === 0) {
        return JSON.stringify({
          error: `Aucun outil disponible sur le serveur MCP '${mcpConfig.name}'`,
          serverInfo: {
            name: mcpConfig.name,
            description: mcpConfig.description
          }
        });
      }
      
      // Analyser la demande utilisateur avec l'IA pour sélectionner l'outil approprié
      let selectedTool: MCPTool | null = null;
      let prefilledArgs: any = {};
      
      if (userQuery) {
        console.log('🤖 Analyse de la demande utilisateur avec IA:', userQuery);
        
        const toolsDescription = tools.map(tool => 
          `- ${tool.name}: ${tool.description || 'Pas de description'}
          Schema: ${JSON.stringify(tool.inputSchema, null, 2)}`
        ).join('\n');

        const analysisPrompt = `Tu es un expert en analyse de demandes utilisateur pour les outils MCP.

Demande utilisateur: "${userQuery}"

Outils MCP disponibles sur le serveur ${mcpConfig.name}:
${toolsDescription}

Analyse cette demande et détermine:
1. Quel outil utiliser (nom exact de l'outil)
2. Quels arguments pré-remplir en analysant la demande

Exemples:
- "recherche sur wikipedia des infos sur la ville de paris" → outil: search_wikipedia, args: {"query": "paris ville"}
- "obtiens l'article wikipedia sur Albert Einstein" → outil: get_article, args: {"title": "Albert Einstein"}
- "résume l'article wikipedia sur la France" → outil: get_summary, args: {"title": "France"}

Réponds UNIQUEMENT avec un JSON valide dans ce format:
{
  "toolName": "nom_exact_de_l_outil",
  "args": {
    "parametre1": "valeur_extraite_de_la_demande",
    "parametre2": "valeur_extraite_de_la_demande"
  }
}

Si tu ne peux pas déterminer l'outil ou les arguments, réponds: null`;

        try {
          const response = await agentModel.invoke(analysisPrompt);
          const content = response.content.toString().trim();
          
          console.log('🤖 Réponse IA analyse:', content);
          
          const cleanContent = content.replace(/```json\n?|```\n?/g, '').trim();
          
          if (cleanContent !== 'null') {
            const analysis = JSON.parse(cleanContent);
            const foundTool = tools.find(t => t.name === analysis.toolName);
            if (foundTool && analysis.args) {
              selectedTool = foundTool;
              prefilledArgs = analysis.args;
              console.log('✅ Outil sélectionné:', selectedTool.name, 'avec args:', prefilledArgs);
            }
          }
        } catch (error) {
          console.error('❌ Erreur analyse IA:', error);
        }
      }
      
      // Si pas d'analyse IA réussie, prendre le premier outil
      if (!selectedTool && tools.length > 0) {
        selectedTool = tools[0];
        console.log('🔄 Utilisation du premier outil par défaut:', selectedTool.name);
      }
      
      // Vérifier qu'on a un outil sélectionné
      if (!selectedTool) {
        return JSON.stringify({
          error: `Aucun outil approprié trouvé pour la demande: "${userQuery}"`,
          serverName: mcpConfig.name,
          userQuery: userQuery || null
        });
      }
      
      // Convertir l'outil sélectionné en schéma de formulaire
      const formFields = convertSchemaToFormFields(selectedTool.inputSchema);
      
      // Pré-remplir les champs avec les arguments analysés
      formFields.forEach(field => {
        if (prefilledArgs[field.name] !== undefined) {
          field.defaultValue = prefilledArgs[field.name];
        }
      });
      
      const formSchema = {
        toolName: selectedTool.name,
        toolDescription: selectedTool.description || '',
        serverName: mcpConfig.name,
        formFields,
        originalSchema: selectedTool.inputSchema,
        prefilledFromQuery: userQuery || null
      };
      
      return JSON.stringify({
        serverName: mcpConfig.name,
        serverDescription: mcpConfig.description,
        toolsCount: 1, // Un seul outil sélectionné
        selectedTool: selectedTool.name,
        userQuery: userQuery || null,
        forms: [formSchema]
      }, null, 2);
      
    } catch (error: any) {
      console.error('Erreur getMcpToolSchemas:', error);
      return JSON.stringify({
        error: `Erreur lors de la récupération des schémas: ${error.message}`,
        serverName: mcpServerName,
        userQuery: userQuery || null
      });
    }
  },
  {
    name: "get_mcp_tool_schemas",
    description: "Analyse la demande utilisateur et génère un formulaire pré-rempli pour l'outil MCP le plus approprié",
    schema: z.object({
      mcpServerName: z.string()
        .describe("Nom du serveur MCP dont on veut récupérer les schémas (ex: 'wikipedia-mcp', 'filesystem')"),
      userQuery: z.string().optional()
        .describe("Demande de l'utilisateur à analyser pour pré-remplir le formulaire (ex: 'recherche sur wikipedia des infos sur la ville de paris')")
    })
  }
); 