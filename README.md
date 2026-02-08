# 🎯 Snipper Bot - Pump.fun Trading Bot

**Automated trading bot for Solana meme tokens on Pump.fun**

---

## ✨ Features

- 🚀 **Auto-detects** new tokens on Pump.fun
- 🧠 **Smart scoring** - Only trades high-momentum tokens
- 🛡️ **Risk management** - Stop losses, position limits
- 📊 **9 Trading Skills** - Sentiment, charts, timing analysis
- 🔔 **Telegram alerts** - Get notified on every trade
- 🎮 **Easy setup** - Interactive wizard guides you through

---

## 🚀 Quick Start (3 Minutes)

### Linux/Mac:
```bash
git clone https://github.com/a7ussein/momentum-sniper-template.git
cd momentum-sniper-template
chmod +x setup-wizard.sh
./setup-wizard.sh
npm start
```

### Windows:
```cmd
git clone https://github.com/a7ussein/momentum-sniper-template.git
cd momentum-sniper-template
setup.bat
npm start
```

### Manual Setup:
```bash
npm install
cp .env.example .env
# Edit .env with your settings
npm start
```

---

## 📋 Setup Wizard

Run `./setup-wizard.sh` and it will:

1. ✅ Check Node.js installation
2. 🔐 Generate wallet OR enter yours
3. ⚙️  Configure RPC (free Helius key)
4. 📱 Setup Telegram notifications (optional)
5. 💾 Save everything automatically

---

## ⚙️ Configuration

### Required:
```env
PRIVATE_KEY=your-solana-private-key
RPC_URL=https://api.mainnet-beta.solana.com
```

### Optional:
```env
HELIUS_API_KEY=free-key-from-helius.xyz
TELEGRAM_BOT_TOKEN=from-@BotFather
TELEGRAM_CHAT_ID=your-chat-id
MAX_POSITION_SOL=0.002
AUTO_TRADE=false
```

---

## 🎮 Running

| Command | Description |
|---------|-------------|
| `npm start` | Start trading |
| `npm run dry-run` | Test mode (no real trades) |
| `node check-status.js` | View status |
| `node test-skills.js` | Test skills |

---

## 🛡️ Safety First

- ✅ Start with small positions (0.002 SOL)
- ✅ Test in dry-run mode first
- ✅ Monitor initially
- ⚠️ Never invest more than you can lose
- ⚠️ Keep private keys secure

---

## 📚 Documentation

- `README.md` - This file
-` - VPS, `DEPLOY.md Raspberry Pi deployment
- `ADAPTIVE_STRATEGY.md` - Strategy details

---

## 🎯 Commands

Bot understands commands via Telegram:

| Command | Description |
|---------|-------------|
| `/status` | View current status |
| `/pause` | Pause trading |
| `/resume` | Resume trading |
| `/balance` | Check wallet balance |
| `/stats` | View trading stats |

---

## 📊 Strategy Modes

| Mode | Position | Risk |
|------|----------|------|
| AGGRESSIVE | 0.01 SOL | High |
| BALANCED | 0.005 SOL | Medium |
| CONSERVATIVE | 0.002 SOL | Low |
| PAUSE | - | None |

Bot auto-switches based on market conditions!

---

## 🔧 API Keys (Free)

| Service | Get Free Key |
|---------|-------------|
| Helius RPC | https://helius.xyz |
| Telegram Bot | @BotFather |

---

## 📁 Project Structure

```
snipper-bot/
├── src/
│   ├── index.js           # Main bot
│   ├── scanner/           # Token detection
│   ├── execution/         # Trading
│   └── utils/             # Helpers
├── skills/                # 9 trading skills
├── .env                   # Your config (secret!)
├── .env.example          # Template
├── setup-wizard.sh       # Interactive setup
├── setup.sh              # Quick setup
└── README.md             # This file
```

---

## ⚠️ Disclaimer

**This software is for educational purposes only.**

Cryptocurrency trading involves substantial risk of loss. Past performance does not guarantee future results. Only invest what you can afford to lose.

The authors are not responsible for any financial losses.

---

## 📞 Support

- Check `DEPLOY.md` for deployment help
- View logs in `bot.log`
- Issues on GitHub

---

**Happy Trading! 🚀**
