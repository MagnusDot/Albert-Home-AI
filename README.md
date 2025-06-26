# 🏠 Albert-Home-AI

**Albert** est un assistant vocal intelligent de nouvelle génération, conçu pour être l'alternative open-source, abordable et ultra-performante à Google Home et Alexa. Propulsé par l'IA moderne et construit avec **LangGraph**, Albert offre une expérience conversationnelle naturelle avec des capacités avancées d'agents intelligents.

## 🎯 Vision

Notre mission est de démocratiser l'accès à une IA domestique vraiment intelligente :
- **🌟 Simple** : Configuration en quelques minutes
- **💰 Abordable** : Fonctionne sur du matériel accessible
- **🚀 Puissant** : IA de pointe avec agents spécialisés
- **🔒 Privé** : Vos données restent chez vous
- **🔧 Extensible** : Créez vos propres agents

## ✨ Fonctionnalités

### 🤖 Agents IA Intelligents
- **Architecture LangGraph** : Agents conversationnels avancés
- **Mémoire persistante** : Albert se souvient de vos préférences
- **Outils spécialisés** : Météo, calculs, recherche web, et plus
- **Extensibilité MCP** : Support du Model Context Protocol

### 🎙️ Interface Vocale (En développement)
- **Reconnaissance vocale** : Parlez naturellement à Albert
- **Synthèse vocale** : Réponses audio fluides
- **Activation par mot-clé** : "Hey Albert !"

### 🔧 API REST Complète
- **Endpoints RESTful** : Intégration facile
- **Streaming SSE** : Réponses en temps réel
- **Authentification** : Sécurité optionnelle
- **Documentation API** : Endpoints bien documentés

## 🏗️ Architecture

```
Albert-Home-AI/
├── 🤖 Agent-AI/              # Cœur de l'intelligence artificielle
│   ├── Agents/               # Agents spécialisés (LangGraph)
│   │   └── myges/           # Agent principal avec outils
│   ├── CLI/                 # Interface en ligne de commande
│   └── serveur/            # API REST + WebSockets
├── 🎙️ Voice_client/         # Client vocal (en développement)
└── 📖 Documentation/        # Guides et tutoriels
```

## 🚀 Installation Rapide

### Prérequis
- **Node.js** v18 ou supérieur
- **npm** ou **yarn**
- **Clé API OpenAI** (ou modèle local compatible)

### 1. Cloner le projet
```bash
git clone https://github.com/votre-username/Albert-Home-AI.git
cd Albert-Home-AI/Agent-AI
```

### 2. Installation des dépendances
```bash
# Backend
npm install
```

### 3. Configuration
```bash
# Copier le fichier de configuration
cp .env.example .env

# Éditer vos clés API
nano .env
```

Variables d'environnement essentielles :
```env
# API OpenAI (ou modèle local)
OPENAI_API_KEY=sk-votre-cle-ici

# Configuration serveur
PORT=8080
API_URL=http://localhost:8080

# Authentification (optionnelle)
REQUIRE_AUTH=false
```

### 4. Démarrage
```bash
# Démarrer le serveur Albert
npm run dev

```

### CLI (pour développeurs)
```bash
# Chat interactif
npm run cli chat

# Vérifier la santé d'Albert
npm run cli check

# Mode debug
npm run cli chat --debug
```

### API REST
```bash
# Santé du système
curl http://localhost:8080/health

# Chat avec Albert
curl -X POST http://localhost:8080/myges/invoke \
  -H "Content-Type: application/json" \
  -d '{"message": "Bonjour Albert, comment ça va ?"}'
```

## 🛠️ Développement

### Ajouter un nouvel agent
1. Créer un dossier dans `Agent-AI/Agents/`
2. Implémenter l'agent avec LangGraph
3. Ajouter les outils nécessaires
4. Enregistrer dans `agents-registry.mts`

### Structure d'un agent
```typescript
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";

const agent = createReactAgent({
  prompt: votre_prompt,
  llm: modele_ia,
  tools: [outil1, outil2, ...],
  checkpointSaver: new MemorySaver(),
});
```

### Outils disponibles
- **🌤️ Météo** : Prévisions météorologiques
- **🧮 Calculs** : Addition, soustraction, multiplication
- **🔗 MCP** : Intégration Model Context Protocol
- **🌐 Web** : Recherche et navigation web

## 🔐 Sécurité & Confidentialité

- **🏠 Local First** : Tout fonctionne en local
- **🔒 Chiffrement** : Communications sécurisées
- **🔑 Authentification** : Contrôle d'accès optionnel
- **📝 Logs** : Journalisation configurable
- **🚫 Pas de tracking** : Zéro télémétrie non désirée

## 🌟 Roadmap

### Phase 1 (Actuelle)
- [x] Architecture LangGraph
- [x] API REST complète
- [x] Agents de base
- [x] Interface vocale simple

### Phase 2 (En cours)
- [ ] 🎙️ Interface vocale complète
- [ ] 🏠 Intégration domotique (Home Assistant)
- [ ] 📱 Application mobile
- [ ] 🧠 Agents spécialisés avancés

### Phase 3 (Future)
- [ ] 🤖 Assistant physique (Raspberry Pi)
- [ ] 🌐 Synchronisation multi-appareils
- [ ] 🎯 IA prédictive
- [ ] 🔌 Marketplace d'agents

## 🤝 Contribution

Albert-Home-AI est un projet open-source ! Nous accueillons toutes les contributions :

1. **🐛 Signaler des bugs** : Issues GitHub
2. **💡 Proposer des fonctionnalités** : Discussions
3. **🔧 Contribuer au code** : Pull Requests
4. **📖 Améliorer la documentation** : Éditions
5. **🎨 Design UI/UX** : Maquettes et suggestions

### Guide de contribution
```bash
# Fork le projet
git fork https://github.com/votre-username/Albert-Home-AI.git

# Créer une branche feature
git checkout -b feature/nouvelle-fonctionnalite

# Commit et push
git commit -m "Ajout: nouvelle fonctionnalité géniale"
git push origin feature/nouvelle-fonctionnalite

# Créer une Pull Request
```

## 📚 Documentation

- **📘 [Guide utilisateur](docs/user-guide.md)** : Utilisation d'Albert
- **🔧 [Guide développeur](docs/developer-guide.md)** : Développement
- **🏗️ [Architecture](docs/architecture.md)** : Détails techniques
- **🎯 [API Reference](docs/api-reference.md)** : Documentation API

## 💪 Support

- **💬 [Discussions GitHub](https://github.com/votre-username/Albert-Home-AI/discussions)** : Questions et idées
- **🐛 [Issues](https://github.com/votre-username/Albert-Home-AI/issues)** : Bugs et problèmes
- **📧 [Email](mailto:support@albert-home.ai)** : Support direct
- **💬 [Discord](https://discord.gg/albert-home-ai)** : Communauté

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE.md](LICENSE.md) pour plus de détails.

---

<div align="center">

**🏠 Transformez votre maison en maison intelligente avec Albert 🤖**

*Simple. Abordable. Puissant.*

[![GitHub stars](https://img.shields.io/github/stars/votre-username/Albert-Home-AI?style=social)](https://github.com/votre-username/Albert-Home-AI)
[![GitHub forks](https://img.shields.io/github/forks/votre-username/Albert-Home-AI?style=social)](https://github.com/votre-username/Albert-Home-AI)
[![GitHub issues](https://img.shields.io/github/issues/votre-username/Albert-Home-AI)](https://github.com/votre-username/Albert-Home-AI/issues)

</div>
