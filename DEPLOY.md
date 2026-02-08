# 🚀 Deploy Guide

Run your sniper bot from anywhere!

---

## Option 1: VPS (Recommended)

### 1. Get a VPS
- **Hetzner** (€4-6/month) - German, good for crypto
- **DigitalOcean** ($4/month) - Easy setup
- **Linode** ($5/month) - Reliable

### 2. Setup VPS

```bash
# Connect to VPS
ssh root@your-vps-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Clone repo
git clone https://github.com/YOUR_USERNAME/momentum-sniper.git
cd momentum-sniper

# Install
npm install

# Create .env
cp .env.example .env
nano .env  # Add your keys

# Run in background
nohup npm start > bot.log 2>&1 &

# Check logs
tail -f bot.log
```

### 3. Keep Running (pm2)

```bash
# Install pm2
npm install -g pm2

# Start bot
pm2 start src/index.js --name sniper

# Auto-restart on reboot
pm2 startup
pm2 save
```

---

## Option 2: Raspberry Pi

```bash
# Install Node.js for Pi
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone & run (same as VPS)
```

---

## Option 3: Cloud IDE (Replit/Railway)

### Replit:
1. Import from GitHub
2. Add secrets (Environment variables)
3. Click "Run"

### Railway:
1. Connect GitHub repo
2. Add environment variables
3. Deploy

---

## Option 4: SSH from Any Computer

```bash
# From any computer with Node.js installed
git clone https://github.com/YOUR_USERNAME/momentum-sniper.git
cd momentum-sniper
npm install
npm start
```

---

## Security Tips

### ⚠️ IMPORTANT

1. **Never commit `.env` to git!**
   - It's in `.gitignore` already
   - Double-check before pushing

2. **Use a dedicated wallet**
   - Don't use your main wallet
   - Only fund with what you can afford to lose

3. **SSH Keys for VPS**
   ```bash
   ssh-keygen -t ed25519
   # Copy public key to VPS
   ```

4. **Firewall**
   ```bash
   ufw allow ssh
   ufw allow 22
   ufw enable
   ```

---

## Quick Reference

| Task | Command |
|------|---------|
| Start | `npm start` |
| Stop | `pkill -f "node src/index.js"` |
| Logs | `tail -f bot.log` |
| Status | `node check-status.js` |
| Update | `git pull && npm install` |

---

## Telegram Notifications

Bot will notify you on:
- ✅ Trade entries
- ✅ Trade exits (profit/loss)
- ⚠️ Critical market conditions
- 🛡️ Protective actions

Just create a bot via @BotFather and add the token to `.env`.

---

## Troubleshooting

**Bot won't start?**
```bash
# Check Node version
node --version  # Should be 18+

# Check errors
tail -50 bot.log
```

**No trades executing?**
- Check `DRY_RUN=false` in `.env`
- Verify wallet has SOL
- Check Telegram for notifications

**Rate limited?**
- Switch to Helius RPC (higher limits)
