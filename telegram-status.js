#!/usr/bin/env node
/**
 * Telegram Status Update Script
 * Sends periodic status updates to Telegram
 */

const fs = require('fs');
const path = require('path');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8195069607:AAGyD6tqfr19JZgeNVRL6k0mj5jvuoVNiwA';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '6388606590';

// Get current status
function getStatus() {
  const logFile = path.join(process.env.HOME || '/home/ahmed', 'sniper.log');
  
  if (!fs.existsSync(logFile)) {
    return { error: 'Log file not found' };
  }
  
  const log = fs.readFileSync(logFile, 'utf8');
  
  // Parse recent activity
  const lines = log.split('\n').slice(-100);
  
  const trades = lines.filter(l => l.includes('EXECUTING BUY')).length;
  const stops = lines.filter(l => l.includes('STOP_LOSS')).length;
  const takes = lines.filter(l => l.includes('TAKE_PROFIT')).length;
  
  // Get last PnL
  const pnlMatch = log.match(/dailyPnL:\s*'([^']+)'/);
  const dailyPnL = pnlMatch ? pnlMatch[1] : 'N/A';
  
  // Get bot status
  const botRunning = lines.some(l => l.includes('Starting') || l.includes('Ready'));
  const marketState = lines.filter(l => l.includes('marketState'))[0]?.match(/'([^']+)'/)?.[1] || 'UNKNOWN';
  
  return {
    botRunning,
    marketState,
    trades,
    stops,
    takes,
    dailyPnL,
    lastUpdate: new Date().toISOString(),
  };
}

// Format status message
function formatStatus(status) {
  let emoji = '🟢';
  if (status.marketState === 'CRITICAL') emoji = '🔴';
  else if (status.marketState === 'BAD') emoji = '🟡';
  
  const pnlEmoji = status.dailyPnL?.startsWith('-') ? '📉' : '📈';
  
  return `
🎯 <b>SNIPPER BOT STATUS</b>

🤖 Bot: ${status.botRunning ? 'Running' : 'Stopped'}
🌊 Market: ${emoji} ${status.marketState}

📊 <b>Today's Stats:</b>
   Trades: ${status.trades}
   🛑 Stop Losses: ${status.stops}
   ✅ Take Profits: ${status.takes}
   ${pnlEmoji} PnL: ${status.dailyPnL} SOL

⏰ Last Update: ${new Date().toLocaleTimeString()}
`;
}

// Send to Telegram
async function sendStatus() {
  const status = getStatus();
  
  if (status.error) {
    console.log('Error:', status.error);
    return;
  }
  
  const message = formatStatus(status);
  
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });
    
    const result = await response.json();
    console.log('Status sent:', result.ok ? '✅' : '❌');
    return result;
  } catch (error) {
    console.error('Failed to send:', error.message);
  }
}

// Run
sendStatus();
