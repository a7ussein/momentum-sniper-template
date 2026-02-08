/**
 * Telegram Notifier for Sniper Trades
 * 
 * Sends trade alerts to configured chat
 */

require('dotenv').config();

let chatId = null;
let botToken = null;

// Load config
function loadConfig() {
  chatId = process.env.TELEGRAM_CHAT_ID;
  botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (chatId) {
    console.log('[telegram] configured');
  }
}

loadConfig();

/**
 * Send a message to Telegram
 */
async function sendMessage(text, options = {}) {
  if (!chatId || !botToken) {
    console.log('[telegram] not configured, skipping notification');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return true;
    } else {
      console.error('[telegram] send failed:', await response.text());
      return false;
    }
  } catch (e) {
    console.error('[telegram] error:', e.message);
    return false;
  }
}

/**
 * Notify of a new trade entry
 */
async function notifyEntry(signal) {
  const text = `🎯 <b>NEW TRADE</b>

💰 <b>Mint:</b> <code>${signal.mint.slice(0, 12)}...</code>
📊 <b>Score:</b> ${signal.momentumScore}/100
🏷️ <b>Tier:</b> ${signal.tier}
📈 <b>Position:</b> ${(signal.positionSizePct * 100).toFixed(0)}%
📉 <b>Curve:</b> ${signal.progress?.toFixed(1)}%`;

  return sendMessage(text);
}

/**
 * Notify of a position update
 */
async function notifyUpdate(mint, pnlPct, reason = '') {
  const emoji = pnlPct >= 0 ? '🟢' : '🔴';
  const text = `📊 <b>POSITION UPDATE</b> ${emoji}

💰 <b>Mint:</b> <code>${mint.slice(0, 12)}...</code>
📈 <b>PnL:</b> ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%
${reason ? `📝 <b>Reason:</b> ${reason}` : ''}`;

  return sendMessage(text);
}

/**
 * Notify of a trade exit
 */
async function notifyExit(mint, pnlPct, reason, duration) {
  const emoji = pnlPct >= 0 ? '✅' : '❌';
  const text = `🚪 <b>TRADE CLOSED</b> ${emoji}

💰 <b>Mint:</b> <code>${mint.slice(0, 12)}...</code>
📈 <b>PnL:</b> ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%
📝 <b>Reason:</b> ${reason}
⏱️ <b>Duration:</b> ${(duration / 60000).toFixed(1)} min

${emoji === '✅' ? '🎉 Nice trade!' : '💸 Roll the dice next one.'}`;

  return sendMessage(text);
}

/**
 * Notify of daily summary
 */
async function notifyDailySummary(stats) {
  const winRate = stats.wins + stats.losses > 0 
    ? ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(0)
    : 0;

  const text = `📊 <b>DAILY SUMMARY</b>

📈 <b>Trades:</b> ${stats.wins + stats.losses}
✅ <b>Wins:</b> ${stats.wins}
❌ <b>Losses:</b> ${stats.losses}
🎯 <b>Win Rate:</b> ${winRate}%
💰 <b>PnL:</b> ${stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toFixed(4)} SOL
${stats.currentDailyLossPct ? `🛡️ <b>Drawdown:</b> ${stats.currentDailyLossPct.toFixed(1)}%` : ''}`;

  return sendMessage(text);
}

/**
 * Send an alert
 */
async function notifyAlert(message, level = 'INFO') {
  const emoji = {
    'INFO': 'ℹ️',
    'WARNING': '⚠️',
    'ERROR': '🚨',
    'SUCCESS': '🎉',
  }[level] || '📢';

  const text = `${emoji} <b>${level}</b>\n\n${message}`;

  return sendMessage(text);
}

/**
 * Send current status summary
 */
async function notifyStatus(status) {
  const emoji = status.marketState === 'CRITICAL' ? '🔴' 
    : status.marketState === 'BAD' ? '🟡' 
    : status.marketState === 'GOOD' ? '🟢' 
    : '⚪';

  const pnlEmoji = status.dailyPnL?.toString().startsWith('-') ? '📉' : '📈';

  const text = `🎯 <b>SNIPPER BOT STATUS</b>

🤖 Bot: ${status.botRunning ? '🟢 Running' : '🔴 Stopped'}
🌊 Market: ${emoji} ${status.marketState || 'UNKNOWN'}

📊 <b>Today's Stats:</b>
   Trades: ${status.trades || 0}
   🛑 Stop Losses: ${status.stopLosses || 0}
   ✅ Take Profits: ${status.takeProfits || 0}
   ${pnlEmoji} PnL: ${status.dailyPnL || '0'} SOL

${status.currentMode ? `🎚️  Mode: <b>${status.currentMode}</b>` : ''}
${status.lastTrade ? `🎰 Last Trade: <code>${status.lastTrade}</code>` : ''}

⏰ ${new Date().toLocaleTimeString()}`;

  return sendMessage(text);
}

module.exports = {
  notifyEntry,
  notifyUpdate,
  notifyExit,
  notifyDailySummary,
  notifyAlert,
  notifyStatus,
  sendMessage,
};
