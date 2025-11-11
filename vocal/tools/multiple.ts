import { tool } from '@openai/agents/realtime';
import chalk from 'chalk';
import { z } from 'zod';

export const multipleTool = tool({
  name: 'multiple',
  description: 'Multiplie deux nombres.',
  parameters: z.object({
    a: z.number().describe('Le premier nombre à multiplier'),
    b: z.number().describe('Le deuxième nombre à multiplier')
  }),
  execute: async ({ a, b }) => {
    const result = a * b;
    console.log(chalk.cyan(`   ✖️  Calcul: ${a} × ${b} = ${result}`));
    return result;
  }
});

