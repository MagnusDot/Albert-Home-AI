#!/bin/bash

# Script pour lancer Albert Voice Client avec Piper TTS
# À utiliser depuis la racine du projet Albert-Home-AI

echo "🎤 Lancement d'Albert Voice Client avec Piper TTS..."
echo "=================================================="

# Aller dans le dossier Voice et activer l'environnement virtuel
cd "$(dirname "$0")/Agent-AI/Voice"

if [ ! -d ".venv" ]; then
    echo "❌ Environnement virtuel non trouvé dans Agent-AI/Voice/.venv"
    echo "💡 Créez-le avec :"
    echo "   cd Agent-AI/Voice"
    echo "   python3 -m venv .venv"
    echo "   source .venv/bin/activate"
    echo "   pip install -r requirements.txt"
    exit 1
fi

echo "🔧 Activation de l'environnement virtuel Python..."
source .venv/bin/activate

# Vérifier que Piper TTS est installé
if ! command -v piper &> /dev/null; then
    echo "❌ Piper TTS non trouvé dans l'environnement virtuel"
    echo "💡 Installez-le avec :"
    echo "   pip install -r requirements.txt"
    exit 1
fi

echo "✅ Piper TTS détecté : $(which piper)"

# Remonter au dossier Agent-AI et lancer le client vocal
cd ..
echo "🚀 Lancement du client vocal..."

# Lancer le client vocal avec le PATH modifié
PATH="Voice/.venv/bin:$PATH" npm run voice 