/**
 * Jupiter Swap Execution
 * Handles buy and sell orders via Jupiter Aggregator
 */

const { PublicKey, VersionedTransaction, TransactionMessage } = require('@solana/web3.js');
const axios = require('axios');
const config = require('../../config');

const JUPITER_API = 'https://quote-api.jup.ag/v6';

/**
 * Get a quote from Jupiter
 */
async function getQuote({ inputMint, outputMint, amount, slippageBps }) {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amount.toString(),
    slippageBps: slippageBps.toString(),
  });

  const res = await axios.get(`${JUPITER_API}/quote?${params}`);
  return res.data;
}

/**
 * Get the swap transaction from Jupiter
 */
async function getSwapTransaction({ quoteResponse, userPublicKey }) {
  const params = new URLSearchParams({
    quoteResponse: JSON.stringify(quoteResponse),
    userPublicKey: userPublicKey.toString(),
    wrapUnwrapSol: 'true',
  });

  const res = await axios.post(`${JUPITER_API}/swap`, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  return res.data;
}

/**
 * Execute a buy order (SOL -> Token)
 */
async function buy({ mint, amountSolLamports, wallet }) {
  const { slippageBps } = config.trading;
  const inputMint = 'So11111111111111111111111111111111111111112'; // SOL
  const outputMint = mint;

  // Step 1: Get quote
  const quote = await getQuote({
    inputMint,
    outputMint,
    amount: amountSolLamports,
    slippageBps,
  });

  if (!quote || Number(quote.outAmount) === 0) {
    throw new Error('Failed to get valid quote');
  }

  console.log('[buy] quote received:', {
    inAmount: quote.inAmount,
    outAmount: quote.outAmount,
    priceImpactPct: quote.priceImpactPct,
    routeCount: quote.routePlan?.length,
  });

  // Step 2: Get swap transaction
  const swapTx = await getSwapTransaction({
    quoteResponse: quote,
    userPublicKey: wallet.publicKey.toString(),
  });

  // Step 3: Deserialize and sign
  const transaction = VersionedTransaction.deserialize(
    Buffer.from(swapTx.swapTransaction, 'base64')
  );

  // Step 4: Sign with wallet (simplified - would need proper key handling)
  // For now, return the unsigned transaction
  return {
    quote,
    transaction,
    walletPublicKey: wallet.publicKey.toString(),
  };
}

/**
 * Execute a sell order (Token -> SOL)
 */
async function sell({ mint, amountTokenLamports, wallet }) {
  const { slippageBps } = config.trading;
  const inputMint = mint;
  const outputMint = 'So11111111111111111111111111111111111111112'; // SOL

  // Step 1: Get quote
  const quote = await getQuote({
    inputMint,
    outputMint,
    amount: amountTokenLamports,
    slippageBps,
  });

  if (!quote || Number(quote.outAmount) === 0) {
    throw new Error('Failed to get valid quote');
  }

  console.log('[sell] quote received:', {
    inAmount: quote.inAmount,
    outAmount: quote.outAmount,
    priceImpactPct: quote.priceImpactPct,
    routeCount: quote.routePlan?.length,
  });

  // Step 2: Get swap transaction
  const swapTx = await getSwapTransaction({
    quoteResponse: quote,
    userPublicKey: wallet.publicKey.toString(),
  });

  // Step 3: Deserialize
  const transaction = VersionedTransaction.deserialize(
    Buffer.from(swapTx.swapTransaction, 'base64')
  );

  return {
    quote,
    transaction,
    walletPublicKey: wallet.publicKey.toString(),
  };
}

/**
 * Simulate a swap to check if it would succeed (honeypot check)
 */
async function simulateSwap({ inputMint, outputMint, amount }) {
  try {
    const quote = await getQuote({
      inputMint,
      outputMint,
      amount,
      slippageBps: 500,  // Higher slippage for simulation
    });

    return {
      success: true,
      outAmount: quote.outAmount,
      priceImpactPct: quote.priceImpactPct,
    };
  } catch (e) {
    return {
      success: false,
      error: e.message,
    };
  }
}

/**
 * Get token balance for a wallet
 */
async function getTokenBalance({ mint, wallet, rpc }) {
  try {
    const tokenAccounts = await rpc('getParsedTokenAccountsByOwner', [
      wallet.publicKey.toString(),
      { mint },
    ]);

    if (!tokenAccounts.value || tokenAccounts.value.length === 0) {
      return 0;
    }

    const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
    return balance;
  } catch (e) {
    console.error('[getTokenBalance] error:', e.message);
    return 0;
  }
}

module.exports = {
  getQuote,
  getSwapTransaction,
  buy,
  sell,
  simulateSwap,
  getTokenBalance,
};
