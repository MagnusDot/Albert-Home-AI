import { tool } from '@openai/agents/realtime';
import chalk from 'chalk';
import { z } from 'zod';

export const weatherTool = tool({
  name: 'weather',
  description: 'Obtient les informations météo en temps réel pour une ville donnée.',
  parameters: z.object({
    ville: z.string().describe('Le nom de la ville pour laquelle obtenir la météo (ex: Paris, London, Tokyo)')
  }),
  execute: async ({ ville }) => {
    try {
      console.log(chalk.cyan(`   🌤️  Récupération météo pour: ${ville}`));
      const url = `https://wttr.in/${encodeURIComponent(ville)}?format=j1&lang=fr`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'curl/7.68.0'
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log(chalk.red(`   ❌ Ville "${ville}" non trouvée`));
          return `❌ Ville "${ville}" non trouvée. Vérifiez l'orthographe.`;
        }
        throw new Error(`Erreur API: ${response.status}`);
      }
      
      const data = await response.json();
      const current = data.current_condition[0];
      const result = `Météo à ${ville}: ${current.temp_C}°C, ${current.weatherDesc[0].value}, humidité ${current.humidity}%`;
      console.log(chalk.cyan(`   ✅ Météo récupérée: ${result}`));
      return result;
    } catch (error: any) {
      console.error(chalk.red(`   ❌ Erreur météo pour "${ville}":`), error);
      return `❌ Impossible de récupérer la météo pour "${ville}".`;
    }
  }
});

