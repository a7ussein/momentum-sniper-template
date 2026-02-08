/**
 * Market Regime Detector Skill
 * 
 * Detect Bull, Bear, or Sideways market conditions.
 */

const fs = require('fs');
const path = require('path');

class MarketRegimeDetector {
  constructor() {
    this.dataDir = path.join(__dirname, '../data/regime');
    this.historyFile = path.join(this.dataDir, 'history.json');
    
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    this.history = this.loadHistory();
  }
  
  loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        return JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
      }
    } catch (e) {
      console.log('[regime] No history found');
    }
    return [];
  }
  
  saveHistory() {
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(this.history.slice(-200), null, 2));
    } catch (e) {
      console.error('[regime] Failed to save:', e.message);
    }
  }
  
  // Analyze market and determine regime
  async analyze(marketData = null) {
    // Use provided data or generate mock
    const data = marketData || this.generateMockData();
    
    // Calculate indicators
    const prices = data.prices || [];
    const volumes = data.volumes || [];
    
    if (prices.length < 20) {
      return {
        regime: 'UNKNOWN',
        confidence: 0,
        message: 'Insufficient data',
      };
    }
    
    // Trend calculation
    const shortMA = prices.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const longMA = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const trend = ((shortMA - longMA) / longMA) * 100;
    
    // Volatility
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    const volatility = returns.reduce((sum, r) => sum + Math.abs(r), 0) / returns.length * 100;
    
    // Volume trend
    const volTrend = volumes.length > 10
      ? (volumes.slice(-5).reduce((a, b) => a + b, 0) / 5) / (volumes.slice(-10).reduce((a, b) => a + b, 0) / 10) - 1
      : 0;
    
    // Determine regime
    let regime = 'SIDEWAYS';
    let confidence = 50;
    let message = '';
    
    if (trend > 5 && volatility > 2 && volTrend > 0) {
      regime = 'BULL';
      confidence = 75;
      message = 'Strong upward trend with volume confirmation';
    } else if (trend > 3 && volatility > 1.5) {
      regime = 'BULL';
      confidence = 65;
      message = 'Bullish momentum detected';
    } else if (trend < -5 && volatility > 2) {
      regime = 'BEAR';
      confidence = 75;
      message = 'Strong downward trend';
    } else if (trend < -3) {
      regime = 'BEAR';
      confidence = 65;
      message = 'Bearish conditions';
    } else if (Math.abs(trend) < 3 && volatility < 2) {
      regime = 'SIDEWAYS';
      confidence = 70;
      message = 'Low volatility - ranging market';
    } else if (volatility > 5) {
      regime = 'CHAOTIC';
      confidence = 60;
      message = 'High volatility - unpredictable';
    }
    
    const result = {
      regime,
      confidence,
      message,
      indicators: {
        trend: trend.toFixed(2) + '%',
        volatility: volatility.toFixed(2) + '%',
        volumeTrend: (volTrend * 100).toFixed(2) + '%',
      },
      recommendation: this.getRecommendation(regime, trend, volatility),
      timestamp: new Date().toISOString(),
    };
    
    this.history.push(result);
    this.saveHistory();
    
    return result;
  }
  
  generateMockData() {
    const prices = [];
    const volumes = [];
    let price = 100;
    const now = Date.now();
    
    for (let i = 0; i < 50; i++) {
      prices.push(price);
      volumes.push(Math.random() * 1000 + 500);
      price = price * (1 + (Math.random() - 0.48) * 0.02);
    }
    
    return { prices, volumes, timestamp: now };
  }
  
  getRecommendation(regime, trend, volatility) {
    if (regime === 'BULL') {
      return { action: 'AGGRESSIVE', message: 'Great conditions for long positions' };
    }
    if (regime === 'BEAR') {
      return { action: 'CAUTION', message: 'Bearish - reduce exposure' };
    }
    if (regime === 'SIDEWAYS') {
      return { action: 'SELECTIVE', message: 'Pick quality setups only' };
    }
    return { action: 'REDUCE', message: 'High risk - be careful' };
  }
  
  // Get current regime
  async getCurrentRegime() {
    const last = this.history[this.history.length - 1];
    if (last) {
      return {
        regime: last.regime,
        confidence: last.confidence + '%',
        message: last.message,
        timestamp: last.timestamp,
      };
    }
    return await this.analyze();
  }
  
  // Get regime history
  async getHistory(hours = 24) {
    const cutoff = Date.now() - hours * 3600000;
    return this.history.filter(h => new Date(h.timestamp) > cutoff);
  }
  
  // Get regime statistics
  async getStats() {
    const recent = this.history.slice(-100);
    
    const regimeCount = {};
    recent.forEach(h => {
      regimeCount[h.regime] = (regimeCount[h.regime] || 0) + 1;
    });
    
    return {
      totalAnalyses: this.history.length,
      recentRegimes: regimeCount,
      current: await this.getCurrentRegime(),
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { MarketRegimeDetector };
