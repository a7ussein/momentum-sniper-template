/**
 * Configuration file for Momentum Sniper
 * 
 * Copy from config.example.js and customize
 */

const baseConfig = require('./config.example.js');

// Override with environment variables where set
if (process.env.RUN_MODE) baseConfig.trading.mode = process.env.RUN_MODE;
if (process.env.WALLET_PRIVATE_KEY) baseConfig.trading.walletPrivateKey = process.env.WALLET_PRIVATE_KEY;
if (process.env.RPC_HTTP_URL) baseConfig.rpc.httpUrl = process.env.RPC_HTTP_URL;
if (process.env.RPC_WS_URL) baseConfig.rpc.wsUrl = process.env.RPC_WS_URL;
if (process.env.HELIUS_API_KEY) baseConfig.rpc.heliusApiKey = process.env.HELIUS_API_KEY;
if (process.env.SLIPPAGE_BPS) baseConfig.trading.slippageBps = parseInt(process.env.SLIPPAGE_BPS);
if (process.env.MAX_POSITIONS) baseConfig.trading.maxPositions = parseInt(process.env.MAX_POSITIONS);
if (process.env.PRIORITY_FEE) baseConfig.trading.priorityFee = parseFloat(process.env.PRIORITY_FEE);
if (process.env.MEV_PROTECTION === 'false') baseConfig.trading.mevProtection = false;

// Sniping settings
baseConfig.trading.slippageBps = 3000;  // 30% slippage
baseConfig.trading.priorityFee = 0.001; // 0.001 SOL priority fee
baseConfig.trading.mevProtection = false; // Off for faster execution

// ALL IN MODE - Swing for the fences
baseConfig.trading.maxPositions = 10;

// Aggressive thresholds
baseConfig.momentum.minScore = 60;

module.exports = baseConfig;
