# 🤖 CLI Agent - Interface de ligne de commande

Interface CLI pour interagir avec les agents IA via le serveur.

## 📋 Configuration

### 1. Variables d'environnement requises

Le CLI utilise automatiquement un fichier `.env` dans ce dossier :

```env
# Token Bearer OBLIGATOIRE pour l'authentification
BEARER=votre-token-jwt-ici

# URL de l'API (optionnel, par défaut http://localhost:8080)
API_URL=http://localhost:8080
```

### 2. Configuration des agents

Le fichier `agents_config.json` contient la liste des agents disponibles :

```json
{
  "api_url": "http://localhost:8080",
  "agents": [
    {
      "id": "sallyO",
      "name": "SallyO",
      "description": "Un agent IA spécialisé dans les opportunités CRM"
    }
  ]
}
```

## 🚀 Utilisation

### Depuis la racine du projet

```bash
# Vérifier la connectivité et lister les agents
npm run cli check

# Démarrer une session de chat
npm run cli chat

# Utiliser un agent spécifique
npm run cli chat --agent sallyO

# Mode invoke (sans streaming)
npm run cli chat --invoke

# Mode debug
npm run cli chat --debug

# Désactiver le contexte de conversation
npm run cli chat --no-context
```

### Directement depuis ce dossier

```bash
# Si vous êtes dans le dossier CLI/
tsx cli.mts check
tsx cli.mts chat
```

## 💬 Commandes durant le chat

Une fois dans une session de chat, vous pouvez utiliser :

- `!clear` - Réinitialiser la conversation
- `!debug` - Basculer le mode debug
- `exit` - Quitter le chat

## 🔧 Options disponibles

### Commande `check`
- `--api-url <url>` - URL de l'API à utiliser
- `-d, --debug` - Mode debug

### Commande `chat`
- `-a, --agent <id>` - ID de l'agent à utiliser
- `-i, --invoke` - Mode invoke (pas de streaming)
- `--api-url <url>` - URL de l'API à utiliser
- `-d, --debug` - Mode debug
- `--no-context` - Désactiver le contexte

## ⚙️ Fonctionnement

1. **Chargement automatique du .env** : Le CLI charge automatiquement les variables depuis `CLI/.env`
2. **Token obligatoire** : La variable `BEARER` doit être définie, sinon le CLI s'arrête avec une erreur
3. **Configuration flexible** : L'URL de l'API peut être surchargée via `--api-url`
4. **Gestion du contexte** : Chaque conversation maintient un ID unique pour le contexte
5. **Streaming en temps réel** : Par défaut, utilise le streaming SSE pour les réponses

## 🐛 Debug et résolution de problèmes

### Problèmes courants

**"ERREUR: La variable BEARER doit être définie"**
```bash
# Solution : Créer ou modifier CLI/.env
echo "BEARER=votre-token-ici" > CLI/.env
```

**"Agent non trouvé"**
```bash
# Vérifier les agents disponibles
npm run cli check
```

**"Erreur de connexion à l'API"**
```bash
# Vérifier que le serveur est démarré
npm run server

# Ou changer l'URL
npm run cli check --api-url http://localhost:8080
```

### Mode debug

```bash
# Activer le debug pour voir tous les détails
npm run cli chat --debug
```

Le mode debug affiche :
- URL des requêtes
- Payload envoyé
- Headers d'authentification
- Événements SSE reçus
- Gestion des conversations

## 🔐 Sécurité

- Le token BEARER est automatiquement ajouté à toutes les requêtes
- Les tokens ne sont jamais affichés en dehors du mode debug
- Chaque conversation a un ID unique généré côté client
- Les tokens sont transmis via Authorization Bearer header

## 📝 Exemples

### Test rapide
```bash
# 1. Vérifier la connectivité
npm run cli check

# 2. Chat simple
npm run cli chat

# 3. Chat avec agent spécifique en mode debug
npm run cli chat --agent sallyO --debug
```

### Workflow typique
```bash
# Session de travail complète
npm run cli check                    # Vérifier que tout fonctionne
npm run cli chat --agent sallyO      # Commencer à chatter
# Dans le chat :
# > Bonjour !
# > !debug                           # Activer le debug si besoin
# > Quelle est la météo aujourd'hui ?
# > !clear                           # Réinitialiser la conversation
# > exit                             # Quitter
```

---

💡 **Le token BEARER est automatiquement utilisé depuis le fichier .env local - pas besoin de le spécifier en ligne de commande !** 