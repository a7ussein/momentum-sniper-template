/**
 * Arbitrage Detector Skill
 * 
 * Find price differences between DEXes for profit opportunities.
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

class ArbitrageDetector {
  constructor() {
    this.dataDir = path.join(__dirname, '../data/arbitrage');
    this.opportunitiesFile = path.join(this.dataDir, 'opportunities.json');
    this.historyFile = path.join(this.dataDir, 'history.json');
    
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    this.opportunities = this.loadOpportunities();
    this.history = this.loadHistory();
  }
  
  loadOpportunities() {
    try {
      if (fs.existsSync(this.opportunitiesFile)) {
        return JSON.parse(fs.readFileSync(this.opportunitiesFile, 'utf8'));
      }
    } catch (e) {}
    return [];
  }
  
  loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        return JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
      }
    } catch (e) {}
    return [];
  }
  
  saveOpportunities() {
    try {
      fs.writeFileSync(this.opportunitiesFile, JSON.stringify(this.opportunities.slice(-100), null, 2));
    } catch (e) {}
  }
  
  saveHistory() {
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(this.history.slice(-500), null, 2));
    } catch (e) {}
  }
  
  // Fetch price from DexScreener
  fetchDexScreener(tokenAddress) {
    return new Promise((resolve) => {
      const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
      
      const req = https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ success: true, data: JSON.parse(data) });
          } catch (e) {
            resolve({ success: false, error: e.message });
          }
        });
      });
      
      req.on('error', (e) => resolve({ success: false, error: e.message }));
      req.setTimeout(5000, () => { req.destroy(); resolve({ success: false, error: 'Timeout' }); });
    });
  }
  
  // Analyze token for arbitrage
  async analyzeToken(tokenAddress) {
    const result = await this.fetchDexScreener(tokenAddress);
    
    if (!result.success) {
      return { token: tokenAddress, error: result.error };
    }
    
    const pairs = result.data.pairs || [];
    if (pairs.length < 2) {
      return { token: tokenAddress, message: 'Only one DEX available' };
    }
    
    // Find best buy and sell prices
    const sorted = pairs.sort((a, b) => 
      parseFloat(a.priceUsd) - parseFloat(b.priceUsd)
    );
    
    const bestBuy = sorted[0];
    const bestSell = sorted[sorted.length - 1];
    
    const buyPrice = parseFloat(bestBuy.priceUsd);
    const sellPrice = parseFloat(bestSell.priceUsd);
    const spread = ((sellPrice - buyPrice) / buyPrice) * 100;
    
    const opportunity = {
      token: tokenAddress,
      buyDex: bestBuy.dexId,
      sellDex: bestSell.dexId,
      buyPrice,
      sellPrice,
      spread: spread.toFixed(2) + '%',
      profitPotential: spread > 1, // Only if >1% spread
      liquidity: parseFloat(bestBuy.liquidity?.usd || 0),
      timestamp: new Date().toISOString(),
    };
    
    this.opportunities.push(opportunity);
    this.saveOpportunities();
    
    return opportunity;
  }
  
  // Get best opportunities
  async getBestOpportunities(limit = 10) {
    const valid = this.opportunities
      .filter(o => o.profitPotential)
      .sort((a, b) => parseFloat(b.spread) - parseFloat(a.spread));
    
    return valid.slice(0, limit);
  }
  
  // Record arbitrage attempt
  async recordAttempt(token, spread, success, profit) {
    const attempt = {
      token,
      spread,
      success,
      profit,
      timestamp: new Date().toISOString(),
    };
    
    this.history.push(attempt);
    this.saveHistory();
    
    return attempt;
  }
  
  // Get stats
  async getStats() {
    const attempts = this.history.slice(-100);
    const successful = attempts.filter(a => a.success).length;
    const totalProfit = attempts.reduce((sum, a) => sum + (a.profit || 0), 0);
    
    return {
      totalScans: this.opportunities.length,
      profitableOpportunities: this.opportunities.filter(o => o.profitPotential).length,
      recentAttempts: attempts.length,
      successRate: attempts.length > 0 ? (successful / attempts.length * 100).toFixed(1) + '%' : 'N/A',
      totalProfit: totalProfit.toFixed(4) + ' SOL',
    };
  }
  
  // Scan for opportunities
  async scan(tokens) {
    const results = [];
    
    for (const token of tokens.slice(0, 20)) { // Limit to 20
      const result = await this.analyzeToken(token);
      results.push(result);
    }
    
    return results;
  }
}

module.exports = { ArbitrageDetector };
