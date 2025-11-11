import { tool } from '@openai/agents/realtime';
import chalk from 'chalk';
import { z } from 'zod';

export const soustracTool = tool({
  name: 'soustrac',
  description: 'Soustrait deux nombres.',
  parameters: z.object({
    a: z.number().describe('Le premier nombre à soustraire'),
    b: z.number().describe('Le deuxième nombre à soustraire')
  }),
  execute: async ({ a, b }) => {
    const result = a - b;
    console.log(chalk.cyan(`   ➖ Calcul: ${a} - ${b} = ${result}`));
    return result;
  }
});

