import 'dotenv/config';

import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { loadAgentPrompt } from "./generate_prompt.mts";
import { agentModel } from './model.mts';
import { add } from './tools/add.mts';
import { multiple } from './tools/multiple.mts';
import { soustrac } from './tools/soustrac.mts';
import { weather } from "./tools/weather.mts";

const albertPrompt = loadAgentPrompt('albert');

const agentCheckpointer = new MemorySaver();
export const albertAgent = createReactAgent({
  prompt: albertPrompt,
  llm: agentModel,
  tools: [weather, add, multiple, soustrac],
  checkpointSaver: agentCheckpointer,
});
