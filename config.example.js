/**
 * MOMENTUM_SNIPER Configuration
 * 
 * Copy this file to config.js and fill in your values
 */

module.exports = {
  // ============ RPC SETTINGS ============
  rpc: {
    httpUrl: process.env.RPC_HTTP_URL || 'https://mainnet.helius-rpc.com/?api-key=' + process.env.HELIUS_API_KEY,
    wsUrl: process.env.RPC_WS_URL || 'wss://mainnet.helius-rpc.com/?api-key=' + process.env.HELIUS_API_KEY,
    // Helius API key (recommended for better rate limits)
    heliusApiKey: process.env.HELIUS_API_KEY || '',
  },

  // ============ TRADING SETTINGS ============
  trading: {
    // Run mode: 'DRY_RUN' (quotes only) or 'LIVE' (real trades)
    mode: process.env.RUN_MODE || 'DRY_RUN',
    
    // Wallet private key (base58 encoded) - REQUIRED for LIVE mode
    walletPrivateKey: process.env.WALLET_PRIVATE_KEY || '',
    
    // Position sizing (% of equity per trade)
    positionSizePct: 0.05,  // 5%
    
    // Slippage basis points (200 = 2%)
    slippageBps: parseInt(process.env.SLIPPAGE_BPS) || 200,
    
    // Max concurrent positions
    maxPositions: 3,
    
    // Max trades per day
    maxDailyTrades: 10,
    
    // Daily loss limit (%)
    dailyLossLimitPct: 15,
    
    // Re-entry cooldown after exit (ms)
    reentryCooldownMs: 120000,
  },

  // ============ SCANNER FILTERS ============
  scanner: {
    // Token must be younger than this (ms)
    maxTokenAgeMs: 180000,  // 3 minutes
    
    // Min liquidity USD equivalent
    minLiquidityUsd: 5000,
    
    // Min bonding curve progress to consider (0-100)
    minCurveProgress: 0,
    
    // Max bonding curve progress (skip graduated tokens)
    maxCurveProgress: 99,
    
    // Min holder count (excluding curve)
    minHolders: 15,
    
    // Min 5m volume SOL
    minVolume5mSol: 0.5,
    
    // Min initial buy SOL
    minInitialBuySol: 0.1,
    
    // Max dev holding %
    maxDevHoldingPct: 25,
    
    // Max fee balance SOL (dump detection)
    maxFeeBalanceSol: 5,
  },

  // ============ MOMENTUM SCORING ============
  momentum: {
    // Weightings (must sum to 1)
    weights: {
      volume: 0.4,
      holders: 0.2,
      curve: 0.4,
    },
    
    // Min momentum score to enter
    minScore: 40,
    
    // Tier thresholds
    tiers: {
      WARM: { minScore: 20, sizeMultiplier: 0.25 },
      HOT: { minScore: 40, sizeMultiplier: 0.5 },
      VERY_HOT: { minScore: 60, sizeMultiplier: 0.75 },
      EXTREME: { minScore: 80, sizeMultiplier: 1.0 },
    },
  },

  // ============ ENTRY CONDITIONS ============
  entry: {
    // Buy tax must be <= this %
    maxBuyTaxPct: 10,
    
    // Simulation must succeed
    requireSimulationPass: true,
    
    // Honeypot check required
    requireHoneypotCheck: true,
    
    // Blacklist check required
    requireBlacklistCheck: true,
  },

  // ============ EXIT CONDITIONS ============
  exit: {
    // Tier 1: Take profit +50% to +100%
    tier1: {
      enabled: true,
      minPct: 50,
      maxPct: 100,
      exitPct: 50,  // Exit 50% of position
    },
    
    // Tier 2: Parabolic move (+100%+), exit remaining
    tier2: {
      enabled: true,
      minPct: 100,
      exitPct: 100,  // Exit all
    },
    
    // Stop loss
    stopLoss: {
      enabled: true,
      pct: -15,  // Exit at -15%
    },
    
    // Time decay (exit if held too long without profit)
    timeDecay: {
      enabled: true,
      maxSlots: 300,  // ~1.5 minutes
      requireProfit: true,
    },
  },

  // ============ FEE MONITORING ============
  feeMonitoring: {
    // Alert if fee balance > X SOL
    alertThresholdSol: 5,
    
    // Fee spike threshold (% increase in 5m)
    spikeThresholdPct: 50,
    
    // Hard exit trigger on fee spike
    feeSpikeExit: true,
  },

  // ============ ANTINOSE FILTERS ============
  antinose: {
    // Skip mints with suspicious patterns
    skipBotPatterns: true,
    
    // Skip mints with suspicious names
    skipSuspiciousNames: true,
    
    suspiciousPatterns: [
      /free.*money/i,
      /airdrop.*claim/i,
      /giveaway/i,
      /1000x/i,
      /5000x/i,
      /10000x/i,
      /musk/i,
      /elon/i,
      /pepe/i,
      /safe.*moon/i,
      /safemoon/i,
      /baby.*dog/i,
      /shiba.*inu/i,
    ],
    
    botPatterns: [
      /^[A-Za-z0-9]{20,}999$/,
      /^[0-9]+999+$/,
    ],
  },

  // ============ STATE PERSISTENCE ============
  persistence: {
    enabled: true,
    
    // Snapshot interval (ms)
    snapshotIntervalMs: 300000,  // 5 minutes
    
    // WAL (write-ahead log) enabled
    useWal: true,
    
    // Storage backend: 'filesystem' or 'redis'
    backend: 'filesystem',
    
    // Directory for snapshots/wal
    dataDir: './data',
  },

  // ============ PERFORMANCE ============
  performance: {
    // Max concurrent validations
    maxConcurrentValidations: 3,
    
    // Validation timeout (ms)
    validationTimeoutMs: 5000,
    
    // RPC spacing (ms) - prevents rate limits
    rpcSpacingMs: 180,
    
    // WebSocket burst limit (tx/sec)
    wsBurstLimit: 3,
  },

  // ============ ALERTS ============
  alerts: {
    // Log level: 'debug', 'info', 'warn', 'error'
    logLevel: 'info',
    
    // Health check interval (ms)
    healthCheckIntervalMs: 60000,
    
    // Alert on scanner error rate
    maxErrorsBeforeAlert: 10,
    
    // Alert if no signals emitted for N minutes
    noSignalsAlertMinutes: 30,
  },
};
