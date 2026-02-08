const axios = require('axios');

/**
 * Get quote from Jupiter V6 API
 * Note: May require API key for some endpoints
 */
async function jupiterQuote({ inputMint, outputMint, amount, slippageBps }) {
  // Try multiple Jupiter endpoints
  const endpoints = [
    'https://quote-api.jup.ag/v6',
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await axios.get(`${endpoint}/quote`, {
        params: { inputMint, outputMint, amount, slippageBps },
        timeout: 5000,
        headers: { 'User-Agent': 'Snipper/1.0' }
      });
      return res.data;
    } catch (e) {
      // Continue to next endpoint
    }
  }

  throw new Error('Jupiter unavailable');
}

/**
 * Estimate price from Pump.fun bonding curve
 * Price = virtualSolReserves / virtualTokenReserves
 */
function estimatePriceFromCurve(virtualSolReserves, virtualTokenReserves) {
  if (!virtualSolReserves || !virtualTokenReserves) return null;
  if (Number(virtualTokenReserves) === 0) return null;

  const virtualSol = BigInt(virtualSolReserves);
  const virtualTokens = BigInt(virtualTokenReserves);
  
  // Price in SOL per token
  const price = Number(virtualSol) / Number(virtualTokens);
  return price;
}

/**
 * Calculate tokens received for given SOL amount
 */
function calculateTokensForSol(solAmount, price) {
  return solAmount / price;
}

/**
 * Get simulated quote based on bonding curve
 */
function simulateQuote({ curveData, solAmount }) {
  if (!curveData || !curveData.virtualSol || !curveData.virtualToken) {
    return null;
  }

  const price = estimatePriceFromCurve(
    curveData.virtualSol,
    curveData.virtualToken
  );

  if (!price || price === 0) return null;

  const tokens = calculateTokensForSol(solAmount, price);
  
  return {
    inAmount: Math.floor(solAmount * 1e9), // SOL in lamports
    outAmount: Math.floor(tokens * 1e6),   // Token with 6 decimals
    priceImpactPct: 0,
    routePlan: [],
    context: 'curve-based',
  };
}

module.exports = { 
  jupiterQuote, 
  estimatePriceFromCurve, 
  simulateQuote,
  calculateTokensForSol 
};
