#!/bin/bash
# 🎯 Momentum Sniper - Quick Setup for GitHub

echo "🚀 Momentum Sniper Bot Setup"
echo "=============================="

# Install Node.js if needed
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "✅ Node.js: $(node --version)"

# Install dependencies
echo "📦 Installing npm dependencies..."
npm install

# Create .env from template
if [ ! -f .env ]; then
    echo "⚙️  Creating .env from template..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Edit .env with your settings!"
    echo "   1. Add your PRIVATE_KEY"
    echo "   2. Add HELIUS_API_KEY (get free key at helius.xyz)"
    echo "   3. Add TELEGRAM_BOT_TOKEN (optional)"
    echo ""
    nano .env
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 To start trading:"
echo "   npm start"
echo ""
echo "📖 See README.md for full documentation"
