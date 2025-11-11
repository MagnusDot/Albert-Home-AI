import { tool } from '@openai/agents/realtime';
import { z } from 'zod';

export function getTools() {
  return [
    tool({
      name: 'add',
      description: 'Additionne deux nombres.',
      parameters: z.object({
        a: z.number().describe('Le premier nombre à additionner'),
        b: z.number().describe('Le deuxième nombre à additionner')
      }),
      execute: async ({ a, b }) => {
        return a + b;
      }
    }),
    tool({
      name: 'multiple',
      description: 'Multiplie deux nombres.',
      parameters: z.object({
        a: z.number().describe('Le premier nombre à multiplier'),
        b: z.number().describe('Le deuxième nombre à multiplier')
      }),
      execute: async ({ a, b }) => {
        return a * b;
      }
    }),
    tool({
      name: 'soustrac',
      description: 'Soustrait deux nombres.',
      parameters: z.object({
        a: z.number().describe('Le premier nombre à soustraire'),
        b: z.number().describe('Le deuxième nombre à soustraire')
      }),
      execute: async ({ a, b }) => {
        return a - b;
      }
    }),
    tool({
      name: 'weather',
      description: 'Obtient les informations météo en temps réel pour une ville donnée.',
      parameters: z.object({
        ville: z.string().describe('Le nom de la ville pour laquelle obtenir la météo (ex: Paris, London, Tokyo)')
      }),
      execute: async ({ ville }) => {
        try {
          const url = `https://wttr.in/${encodeURIComponent(ville)}?format=j1&lang=fr`;
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'curl/7.68.0'
            }
          });
          
          if (!response.ok) {
            if (response.status === 404) {
              return `❌ Ville "${ville}" non trouvée. Vérifiez l'orthographe.`;
            }
            throw new Error(`Erreur API: ${response.status}`);
          }
          
          const data = await response.json();
          const current = data.current_condition[0];
          return `Météo à ${ville}: ${current.temp_C}°C, ${current.weatherDesc[0].value}, humidité ${current.humidity}%`;
        } catch (error: any) {
          console.error('Erreur météo:', error);
          return `❌ Impossible de récupérer la météo pour "${ville}".`;
        }
      }
    })
  ];
}

