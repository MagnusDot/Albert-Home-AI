import { tool } from '@openai/agents/realtime';
import chalk from 'chalk';
import { z } from 'zod';

export const addTool = tool({
  name: 'add',
  description: 'Additionne deux nombres.',
  parameters: z.object({
    a: z.number().describe('Le premier nombre à additionner'),
    b: z.number().describe('Le deuxième nombre à additionner')
  }),
  execute: async ({ a, b }) => {
    const result = a + b;
    console.log(chalk.cyan(`   ➕ Calcul: ${a} + ${b} = ${result}`));
    return result;
  }
});

