#!/bin/bash
# 📱 Quick Status - Send bot status to Telegram

cd /home/ahmed/bots/momentum-sniper

# Get current status from logs
STATUS=$(tail -100 ~/sniper.log)

TRADES=$(echo "$STATUS" | grep -c "EXECUTING BUY" || echo 0)
STOPS=$(echo "$STATUS" | grep -c "STOP_LOSS" || echo 0)
TAKES=$(echo "$STATUS" | grep -c "TAKE_PROFIT" || echo 0)
PNL=$(echo "$STATUS" | grep -o "dailyPnL: '[0-9.-]*'" | tail -1 | grep -o "[0-9.-]*" || echo "0")
MARKET=$(echo "$STATUS" | grep -o "marketState: '[A-Z]*'" | tail -1 | grep -o "[A-Z]*" || echo "UNKNOWN")

# Send to Telegram
curl -s -X POST "https://api.telegram.org/bot8195069607:AAGyD6tqfr19JZgeNVRL6k0mj5jvuoVNiwA/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "6388606590",
    "text": "🎯 SNIPPER BOT STATUS\n\n🌊 Market: '"$MARKET"'\n📊 Trades: '"$TRADES"'\n🛑 Stops: '"$STOPS"'\n✅ Takes: '"$TAKES"'\n💰 PnL: '"$PNL"' SOL\n\n⏰ '"$(date '+%H:%M:%S')"'",
    "parse_mode": "HTML"
  }' > /dev/null

echo "✅ Status sent!"
