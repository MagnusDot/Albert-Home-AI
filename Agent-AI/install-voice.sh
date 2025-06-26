#!/bin/bash

echo "🐦 Installation du client vocal Albert-Home-AI (Whisper Local)"
echo "============================================================="

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez installer Node.js v18+"
    exit 1
fi

echo "✅ Node.js détecté: $(node --version)"

# Vérifier npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm n'est pas installé"
    exit 1
fi

echo "✅ npm détecté: $(npm --version)"

# Installer les dépendances
echo "📦 Installation des dépendances..."
npm install

# Vérifier si .env existe
if [ ! -f ".env" ]; then
    echo "📝 Création du fichier .env..."
    if [ -f "env.example" ]; then
        cp env.example .env
        echo "✅ Fichier .env créé à partir de env.example"
        echo "⚠️  N'oubliez pas de configurer vos clés API dans .env"
    else
        echo "❌ Fichier env.example non trouvé"
        exit 1
    fi
else
    echo "✅ Fichier .env déjà présent"
fi

# Créer les répertoires nécessaires
echo "📁 Création des répertoires..."
mkdir -p Voice/audio
mkdir -p Voice/models
echo "✅ Répertoires créés"

# Télécharger le modèle Whisper
echo "🤖 Téléchargement du modèle Whisper local..."
echo "⚠️  Cela peut prendre quelques minutes (74 MB à télécharger)"
npm run whisper:download

# Vérifier les permissions audio (Linux/macOS)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "🔊 Vérification des permissions audio (Linux)..."
    if command -v arecord &> /dev/null; then
        echo "✅ arecord détecté"
    else
        echo "⚠️  arecord non trouvé. Installez alsa-utils: sudo apt install alsa-utils"
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🔊 Vérification des permissions audio (macOS)..."
    echo "✅ macOS détecté - Permissions audio à configurer manuellement"
fi

echo ""
echo "🎉 Installation terminée !"
echo ""
echo "📋 Prochaines étapes:"
echo "1. Éditez le fichier .env avec vos clés API"
echo "2. Démarrez le serveur: npm run dev"
echo "3. Démarrez le client vocal: npm run voice"
echo ""
echo "🔒 Avantages Whisper Local:"
echo "   ✅ 100% privé - Aucune donnée envoyée à l'extérieur"
echo "   ✅ Fonctionne hors ligne"
echo "   ✅ Pas de coût API"
echo "   ✅ Transcription instantanée"
echo ""
echo "📖 Documentation: Voice/README.md" 