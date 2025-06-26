import 'dotenv/config';

import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { loadAgentPrompt } from "./generate_prompt.mts";
import { agentModel } from './model.mts';
import { add } from './tools/add.mts';
import { getMcpToolSchemas, listMcpServers, mcpClient } from './tools/mcp_client.mts';
import { multiple } from './tools/multiple.mts';
import { soustrac } from './tools/soustrac.mts';
import { weather } from "./tools/weather.mts";

const albertPrompt = loadAgentPrompt('albert');
/*
const agentModel = new ChatOpenAI({ 
  temperature: 0.5,
  model: "dolphin3.0-llama3.1-8b", // ou le nom de votre modèle
  configuration: {
    baseURL: "http://localhost:1234/v1",
    apiKey: "not-needed", // LMStudio ne nécessite pas de clé API réelle
  }
});

*/


const agentCheckpointer = new MemorySaver();
export const albertAgent = createReactAgent({
  prompt: albertPrompt,
  llm: agentModel,
  tools: [weather, add, multiple, soustrac, mcpClient, listMcpServers, getMcpToolSchemas],
  checkpointSaver: agentCheckpointer,
});
