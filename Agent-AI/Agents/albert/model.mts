import { ChatOpenAI } from "@langchain/openai";

export const agentModel = new ChatOpenAI({ 
  temperature: 0.5, 
  model: "gpt-4.1-mini" 
});
