/**
 * MOMENTUM_SNIPER - Main Entry Point
 * 
 * A high-frequency sniper bot for Pump.fun token launches on Solana
 * With adaptive strategy and learning memory
 */

require('dotenv').config();
const config = require('../config');
const fs = require('fs');
const path = require('path');
const { Keypair } = require('@solana/web3.js');

// Import modules
const PumpFunScanner = require('./scanner/pumpfunScanner');
const { makeRpcClient } = require('./utils/rpc');
const { ValidationQueue } = require('./scanner/validationQueue');
const { extractMintFromTx } = require('./scanner/mintExtractor');
const { quickFilterTxMeta } = require('./scanner/quickFilters');
const { TTLCache } = require('./utils/ttlCache');
const { quote } = require('./execution/jupiterQuote');
const { PositionManager } = require('./execution/positionManager');
const { StateManager } = require('./state/stateManager');
const { HealthServer } = require('./utils/healthServer');
const { notifyEntry, notifyExit, notifyUpdate, notifyAlert } = require('./utils/telegram');
const { AdaptiveStrategyManager } = require('./utils/adaptiveStrategy');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║           MOMENTUM_SNIPER v2.0.0                          ║');
console.log('║  Adaptive Sniper with Learning Memory                    ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('[main] Starting with adaptive strategy...');

// Initialize adaptive strategy manager
const strategyManager = new AdaptiveStrategyManager();

// Load wallet
let wallet = null;
if (config.trading.mode === 'LIVE') {
  const walletPath = process.env.WALLET_PATH;
  const privateKey = process.env.WALLET_PRIVATE_KEY;
  
  if (walletPath && fs.existsSync(walletPath)) {
    try {
      const keyData = require(walletPath);
      wallet = Keypair.fromSecretKey(new Uint8Array(keyData));
      console.log('[main] Wallet loaded from:', walletPath);
      console.log('[main] Public Key:', wallet.publicKey.toString());
    } catch (e) {
      console.error('[main] Failed to load wallet:', e.message);
      process.exit(1);
    }
  } else if (privateKey) {
    // Support base58 private key
    try {
      const bs58 = require('bs58');
      wallet = Keypair.fromSecretKey(bs58.decode(privateKey));
      console.log('[main] Wallet loaded from base58 key');
      console.log('[main] Public Key:', wallet.publicKey.toString());
    } catch (e) {
      console.error('[main] Failed to load wallet from private key:', e.message);
      process.exit(1);
    }
  } else {
    console.error('[main] ERROR: WALLET_PATH or WALLET_PRIVATE_KEY required for LIVE mode');
    process.exit(1);
  }
}

// ============ INITIALIZE COMPONENTS ============

// RPC client
const rpc = makeRpcClient(config.rpc.httpUrl);
let lastRpcAt = 0;
function rpcSpacing(minGapMs) {
  return new Promise((resolve) => {
    const now = Date.now();
    const wait = Math.max(0, lastRpcAt + minGapMs - now);
    if (wait) {
      setTimeout(() => {
        lastRpcAt = Date.now();
        resolve();
      }, wait);
    } else {
      lastRpcAt = now;
      resolve();
    }
  });
}

// Position manager (only for LIVE mode)
let positionManager = null;
if (config.trading.mode === 'LIVE' && wallet) {
  positionManager = new PositionManager({ rpc, wallet });
  console.log('[main] Position manager enabled');
}

// State persistence
const stateManager = new StateManager({ dataDir: config.persistence.dataDir });

// Caches
const seenMints = new TTLCache({ ttlMs: 24 * 60 * 60 * 1000 }); // 24h
setInterval(() => seenMints.cleanup(), 60_000).unref();

const seenSigs = new TTLCache({ ttlMs: 10 * 60 * 1000 }); // 10 min
setInterval(() => seenSigs.cleanup(), 60_000).unref();

// Stats tracking
const stats = {
  wsMintEvents: 0,
  queued: 0,
  txFetched: 0,
  signalsEmitted: 0,
  positionsOpened: 0,
  quoteOk: 0,
  quoteFail: 0,
};

// Validation queue
let validationQueue = null;

// Track for monitoring
let lastTradeTime = 0;
let tradesToday = 0;
let lastTradeDate = new Date().toDateString();
let startBalanceLamports = 14140719; // 0.014 SOL baseline

// ============ BALANCE MONITORING ============

async function checkBalance() {
  try {
    const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [wallet.publicKey.toString()]
      })
    });
    const data = await response.json();
    return data.result?.value || 0;
  } catch (e) {
    return null;
  }
}

async function monitorPerformance() {
  const currentBalance = await checkBalance();
  if (!currentBalance) return;
  
  const solBalance = currentBalance / 1e9;
  const change = (currentBalance - startBalanceLamports) / 1e9;
  const changePct = (change / startBalanceLamports) * 1e9 * 100;
  
  console.log('[monitor] 💰 Balance:', solBalance.toFixed(4), 'SOL', 
    change >= 0 ? `(+${change.toFixed(4)})` : `(${change.toFixed(4)})`);
  
  // Alert if losing significantly
  if (change < -0.005) {
    await notifyAlert(`⚠️ Down ${change.toFixed(4)} SOL. Consider adjusting strategy.`, 'WARNING');
  }
  
  // Update baseline occasionally
  if (tradesToday % 20 === 0) {
    startBalanceLamports = currentBalance;
  }
}

// Check balance every 10 minutes
setInterval(monitorPerformance, 10 * 60 * 1000);

// ============ TRADE EXECUTION ============

async function _executeTrade(signal) {
  const { mint, positionSizePct, curveData } = signal;
  
  if (!wallet) {
    console.log('[trade] no wallet available');
    return;
  }

  const enableRealTrades = process.env.ENABLE_REAL_TRADES === 'true';
  
  if (!enableRealTrades) {
    console.log('[trade] Real trades disabled');
    return;
  }

  // Use adaptive strategy
  const strategyConfig = strategyManager.getConfig();
  const maxPositionSol = parseFloat(process.env.MAX_POSITION_SOL) || strategyConfig.positionSize;
  const positionSol = Math.min(maxPositionSol, positionSizePct * 3);
  const lamports = Math.floor(positionSol * 1e9);
  
  console.log('[trade] 💰 EXECUTING BUY:', {
    mint: mint.slice(0, 12) + '...',
    solAmount: positionSol.toFixed(4),
    positionPct: (positionSizePct * 100).toFixed(0) + '%',
    strategy: strategyManager.currentStrategy,
  });

  // Notify via Telegram BEFORE executing
  await notifyEntry({
    ...signal,
    actualSolAmount: positionSol,
  });

  try {
    // Try Jupiter quote first
    let q = null;
    try {
      const { jupiterQuote } = require('./execution/jupiterQuote');
      q = await jupiterQuote({
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: mint,
        amount: lamports,
        slippageBps: config.trading.slippageBps,
      });
    } catch (e) {
      console.log('[trade] Jupiter unavailable, using curve-based pricing');
      
      // Fallback: Use curve-based pricing for Pump.fun tokens
      const { simulateQuote } = require('./execution/jupiterQuote');
      q = simulateQuote({ curveData, solAmount: positionSol });
    }

    if (!q) {
      throw new Error('Could not get quote');
    }

    console.log('[trade] 📊 Quote:', {
      outAmount: q.outAmount,
      priceImpactPct: q.priceImpactPct,
      source: q.context || 'jupiter',
    });

    // Calculate entry price
    const entryPrice = Number(q.outAmount) / lamports;

    // For safety, log the trade
    console.log('[trade] ✅ Position recorded:', {
      mint: mint.slice(0, 8) + '...',
      solAmount: positionSol.toFixed(4),
      entryPrice: entryPrice.toFixed(12),
    });

    // Open position for tracking
    const position = await positionManager.openPosition({
      mint,
      entryPrice,
      tokens: Number(q.outAmount),
      solInvested: positionSol,
      signal,
    });

    if (position) {
      stats.positionsOpened++;
      stateManager.addPosition(mint, position);
      
      // Track trades
      tradesToday++;
      lastTradeTime = Date.now();
      
      // Notify
      await notifyEntry({
        ...signal,
        actualSolAmount: positionSol,
        positionsOpen: stateManager.state.positions.size,
        tradesToday,
      });
    }
  } catch (e) {
    console.error('[trade] ❌ Trade error:', e.message);
    await notifyAlert(`Trade failed: ${e.message}`, 'ERROR');
  }
}

async function _dryRunQuote(signal) {
  const { mint } = signal;
  
  try {
    await rpcSpacing(config.performance.rpcSpacingMs);
    
    const inputMint = 'So11111111111111111111111111111111111111112';
    const amount = 10000000;
    const slippageBps = config.trading.slippageBps;

    const q = await quote({
      inputMint,
      outputMint: mint,
      amount,
      slippageBps,
    });

    console.log('[dryrun] 📊 QUOTE:', {
      mint,
      inAmount: q.inAmount,
      outAmount: q.outAmount,
      priceImpactPct: q.priceImpactPct,
      routeCount: q.routePlan?.length,
    });
    
    stats.quoteOk++;
  } catch (e) {
    console.log('[dryrun] quote failed:', String(e?.message || e));
    stats.quoteFail++;
  }
}

// ============ MAIN ============

async function main() {
  // Try to recover from last state
  const recoveredState = await stateManager.load();
  if (recoveredState) {
    console.log('[main] Recovered previous state');
  }

  // Initialize state if fresh start
  if (!stateManager.getState()) {
    await stateManager.initialize({
      scanner: {
        seenMints: new Map(),
        completedMints: new Set(),
      },
      positions: new Map(),
    });
  }

  // Position manager for LIVE mode
  if (config.trading.mode === 'LIVE') {
    console.log('[main] LIVE mode - position management enabled');
  }

  // Validation queue
  validationQueue = new ValidationQueue({
    concurrency: config.performance.maxConcurrentValidations,
    rpc,
    rpcSpacing,
  });

  // Stats logging
  setInterval(() => {
    console.log('[stats]', {
      wsEvents: stats.wsMintEvents,
      queued: stats.queued,
      signals: stats.signalsEmitted,
      positions: positionManager?.getStats()?.openPositions || 0,
      dailyPnL: positionManager?.getStats()?.dailyStats?.totalPnL?.toFixed(4) || '0',
      quoteOk: stats.quoteOk,
      quoteFail: stats.quoteFail,
    });
    
    // Log adaptive strategy status
    const strategyStatus = strategyManager.getStatus();
    console.log('[strategy] 🧠', {
      mode: strategyStatus.currentStrategy,
      winRate: strategyStatus.todayStats.winRate,
      marketState: strategyStatus.marketHealth.state,
    });
  }, 10_000).unref();

  // ============ SCANNER SETUP ============

  const scanner = new PumpFunScanner({
    rpcWsUrl: config.rpc.wsUrl,
  });

  let burstCount = 0;
  setInterval(() => { burstCount = 0; }, 1000).unref();

  // Handle mint detection
  scanner.on('mint', async ({ signature }) => {
    stats.wsMintEvents++;

    if (seenSigs.has(signature)) return;
    seenSigs.add(signature);

    if (burstCount++ > config.performance.wsBurstLimit) return;

    try {
      await rpcSpacing(config.performance.rpcSpacingMs);

      // Fetch transaction
      let tx = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          tx = await rpc('getTransaction', [
            signature,
            { commitment: 'confirmed', maxSupportedTransactionVersion: 0 }
          ]);
          break;
        } catch (e) {
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 200));
          }
        }
      }

      if (!tx) return;

      // Quick filter: age check
      const nowMs = Date.now();
      const metaCheck = quickFilterTxMeta({
        blockTime: tx.blockTime,
        nowMs,
        maxAgeSec: 180
      });
      if (!metaCheck.ok) return;

      stats.agePassed++;

      // Extract mint from transaction
      const mint = await extractMintFromTx({ tx, rpc });
      if (!mint) {
        console.log('[main] could not extract mint from:', signature.slice(0, 8));
        return;
      }

      // Dedupe by mint
      if (seenMints.has(mint)) return;
      seenMints.add(mint);

      console.log('[main] extracted mint:', mint.slice(0, 8) + '...', 'from tx:', signature.slice(0, 8));
      stats.queued++;
      validationQueue.push(mint, { detectedAt: Date.now(), signature });
    } catch (e) {
      console.error('[main] mint extraction error:', e.message);
    }
  });

  // Handle validation signals
  validationQueue.on('signal', async (signal) => {
    stats.signalsEmitted++;
    
    console.log('[signal] 🚀 TRADE OPPORTUNITY:', {
      mint: signal.mint,
      momentumScore: signal.momentumScore,
      tier: signal.tier,
      positionSizePct: (signal.positionSizePct * 100).toFixed(0) + '%',
    });

    stateManager.addSignal(signal);

    if (config.trading.mode === 'LIVE' && positionManager) {
      await _executeTrade(signal);
    } else {
      await _dryRunQuote(signal);
    }
  });

  // Start scanner
  scanner.start();

  console.log('[main] Scanner started');
  console.log('[main] Mode:', config.trading.mode);
  console.log('[main] Ready for trades!');

  // Listen for position events
  if (positionManager) {
    positionManager.on('partialExit', async ({ position, exitPct, reason }) => {
      console.log('[position] partial exit:', position.mint.slice(0, 12), reason);
      await notifyUpdate(position.mint, position.pnlPct, `Partial exit: ${exitPct * 100}%`);
    });

    positionManager.on('closed', async ({ position, reason }) => {
      console.log('[position] closed:', position.mint.slice(0, 12), reason);
      const duration = Date.now() - position.entryTime;
      const won = position.pnlPct > 0;
      
      // Record for adaptive strategy
      await strategyManager.onTradeExit({
        won,
        pnlPct: position.pnlPct,
        tokenData: { mint: position.mint },
      });
      
      await notifyExit(position.mint, position.pnlPct, reason, duration);
    });

    positionManager.on('circuitBreaker', async ({ reason }) => {
      console.log('[position] circuit breaker:', reason);
      await notifyAlert(`Circuit breaker triggered: ${reason}`, 'WARNING');
    });
  }
}

// ============ HEALTH SERVER ============

let healthServer = null;
if (config.alerts?.enableHealthServer !== false) {
  healthServer = new HealthServer({
    positionManager,
    validationQueue,
    stateManager,
    port: config.alerts?.healthPort || 3000,
  });
  healthServer.start();
}

// ============ GRACEFUL SHUTDOWN ============

process.on('SIGINT', async () => {
  console.log('\n[main] Shutting down...');
  
  if (healthServer) healthServer.stop();
  await stateManager.shutdown();
  
  console.log('[main] Goodbye!');
  process.exit(0);
});

process.on('uncaughtException', (e) => {
  console.error('[main] Uncaught exception:', e);
  
  stateManager.shutdown().then(() => {
    process.exit(1);
  });
});

// Start
main().catch(e => {
  console.error('[main] Failed to start:', e);
  process.exit(1);
});
