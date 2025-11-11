import chalk from 'chalk';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function loadAlbertPrompt(): string {
  try {
    const promptPath = join(__dirname, '../prompt.md');
    let prompt = readFileSync(promptPath, 'utf-8');
    
    const now = new Date();
    const date = now.toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const heure = now.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    prompt = prompt.replace('{date}', date);
    prompt = prompt.replace('{heure}', heure);
    
    return prompt;
  } catch (error) {
    console.error(chalk.red('❌ Erreur lors du chargement du prompt:'), error);
    return 'Tu es Albert, un assistant vocal gentil et agréable.';
  }
}

