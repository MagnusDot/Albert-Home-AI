# 🎤 Albert Voice Agent - OpenAI

Agent vocal utilisant l'API Voice Agents d'OpenAI pour une expérience speech-to-speech complète.

## 🚀 Installation

```bash
cd vocal
npm install
```

## ⚙️ Configuration

Assurez-vous d'avoir une clé API OpenAI dans le fichier `.env` du dossier `Agent-AI` :

```env
OPENAI_API_KEY=sk-votre-cle-openai-ici
```

## 🎯 Utilisation

```bash
npm start
```

ou en mode développement avec rechargement automatique :

```bash
npm run dev
```

## ✨ Fonctionnalités

- **Speech-to-Speech** : Conversation vocale complète via l'API OpenAI
- **Outils intégrés** : Calculs (add, multiple, soustrac) et météo (weather)
- **Personnalité Albert** : Utilise le prompt d'Albert depuis `Agent-AI/Agents/albert/prompt.md`
- **Temps réel** : Transcription et réponse vocale en temps réel

## 📋 Prérequis

- Node.js v18 ou supérieur
- Clé API OpenAI avec accès à l'API Voice Agents
- Microphone configuré sur votre système

## 🔧 Architecture

L'agent vocal utilise :
- `@openai/agents/realtime` pour la gestion de la session vocale
- Le prompt d'Albert depuis `../Agent-AI/Agents/albert/prompt.md`
- Les outils définis dans le code (calculs et météo)

