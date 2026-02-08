/**
 * Volatility Predictor Skill
 * 
 * Predict market volatility and time entries better.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

class VolatilityPredictor {
  constructor() {
    this.heliusKey = process.env.HELIUS_API_KEY || '613ad986-5a0b-40c9-a543-f547870938c2';
    this.historyFile = path.join(__dirname, '../../bots/momentum-sniper/data/volatility-history.json');
    this.history = this.loadHistory();
    
    this.volatilityLevels = {
      LOW: { threshold: 0.02, emoji: '🟢' },
      MEDIUM: { threshold: 0.05, emoji: '🟡' },
      HIGH: { threshold: 0.10, emoji: '🟠' },
      EXTREME: { threshold: Infinity, emoji: '🔴' },
    };
  }
  
  loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        return JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
      }
    } catch (e) {
      console.log('[volatility] No history file found');
    }
    return {
      prices: [],
      volumes: [],
      timestamps: [],
    };
  }
  
  saveHistory() {
    try {
      // Keep last 1000 data points
      const trimmed = {
        prices: this.history.prices.slice(-1000),
        volumes: this.history.volumes.slice(-1000),
        timestamps: this.history.timestamps.slice(-1000),
      };
      fs.writeFileSync(this.historyFile, JSON.stringify(trimmed, null, 2));
    } catch (e) {
      console.error('[volatility] Failed to save history:', e.message);
    }
  }
  
  async getRecentPrices(limit = 50) {
    // In a real implementation, this would fetch from an API
    // For now, generate realistic mock data based on time of day
    
    const hour = new Date().getHours();
    const isAsianHours = hour >= 1 && hour < 10;
    const isAmericanHours = hour >= 14 && hour < 18;
    const isEuropeanHours = hour >= 8 && hour < 16;
    
    const baseVolatility = isAsianHours ? 0.03 : (isEuropeanHours ? 0.05 : 0.04);
    
    const prices = [];
    const now = Date.now();
    
    for (let i = 0; i < limit; i++) {
      const volatility = baseVolatility * (0.5 + Math.random());
      const change = (Math.random() - 0.5) * volatility * 2;
      
      prices.push({
        timestamp: now - (limit - i) * 60000,
        price: 100 + change * 100,
        volume: Math.random() * 1000,
      });
    }
    
    return prices;
  }
  
  async calculateVolatility(prices) {
    if (prices.length < 2) return 0;
    
    // Calculate returns
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      const ret = (prices[i].price - prices[i-1].price) / prices[i-1].price;
      returns.push(ret);
    }
    
    // Standard deviation of returns
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }
  
  async detectPattern(prices) {
    if (prices.length < 10) return 'INSUFFICIENT_DATA';
    
    const recent = prices.slice(-10);
    const changes = recent.map((p, i) => 
      i > 0 ? (p.price - recent[i-1].price) / recent[i-1].price : 0
    );
    
    const trend = changes.reduce((a, b) => a + b, 0);
    const volatility = await this.calculateVolatility(recent);
    
    if (trend > 0.02 && volatility < 0.05) {
      return 'BULLISH_STABLE';
    } else if (trend < -0.02 && volatility < 0.05) {
      return 'BEARISH_STABLE';
    } else if (trend > 0.02 && volatility > 0.08) {
      return 'BULLISH_VOLATILE';
    } else if (trend < -0.02 && volatility > 0.08) {
      return 'BEARISH_VOLATILE';
    } else if (volatility > 0.1) {
      return 'CHAOTIC';
    } else {
      return 'CONSOLIDATING';
    }
  }
  
  async predict() {
    const prices = await this.getRecentPrices(50);
    const volatility = await this.calculateVolatility(prices);
    const pattern = await this.detectPattern(prices);
    
    // Determine volatility level
    let level = 'LOW';
    for (const [name, data] of Object.entries(this.volatilityLevels)) {
      if (volatility <= data.threshold) {
        level = name;
        break;
      }
    }
    
    // Time-based adjustments
    const hour = new Date().getHours();
    let timeQuality = 'NEUTRAL';
    
    if (hour >= 13 && hour <= 17) {
      timeQuality = 'EXCELLENT'; // US market hours
    } else if (hour >= 9 && hour <= 12) {
      timeQuality = 'GOOD'; // European overlap
    } else if (hour >= 1 && hour < 6) {
      timeQuality = 'POOR'; // Asian hours - lower volume
    }
    
    // Generate recommendation
    const recommendation = this.getRecommendation(level, pattern, timeQuality);
    
    const prediction = {
      volatility: (volatility * 100).toFixed(2),
      level,
      pattern,
      timeQuality,
      hour,
      recommendation,
      timestamp: new Date().toISOString(),
    };
    
    // Record for learning
    this.history.prices.push(...prices.map(p => p.price));
    this.history.volumes.push(...prices.map(p => p.volume));
    this.history.timestamps.push(...prices.map(p => p.timestamp));
    this.saveHistory();
    
    return prediction;
  }
  
  getRecommendation(level, pattern, timeQuality) {
    const scores = {
      LOW: 2,
      MEDIUM: 1,
      HIGH: -1,
      EXTREME: -2,
    };
    
    const timeScores = {
      EXCELLENT: 2,
      GOOD: 1,
      NEUTRAL: 0,
      POOR: -1,
    };
    
    const patternScores = {
      BULLISH_STABLE: 2,
      BULLISH_VOLATILE: 1,
      CONSOLIDATING: 0,
      BEARISH_STABLE: -1,
      BEARISH_VOLATILE: -2,
      CHAOTIC: -2,
    };
    
    const totalScore = scores[level] + timeScores[timeQuality] + patternScores[pattern];
    
    if (totalScore >= 3) {
      return {
        action: 'TRADE_AGGRESSIVE',
        confidence: 80,
        message: '🚀 Excellent conditions - Full speed ahead',
      };
    } else if (totalScore >= 1) {
      return {
        action: 'TRADE_NORMAL',
        confidence: 60,
        message: '⚖️ Normal conditions - Proceed with caution',
      };
    } else if (totalScore >= -1) {
      return {
        action: 'TRADE_CONSERVATIVE',
        confidence: 40,
        message: '🛡️ Caution advised - Small positions only',
      };
    } else {
      return {
        action: 'PAUSE',
        confidence: 70,
        message: '🛑 Poor conditions - Consider pausing',
      };
    }
  }
  
  async getVolatilityHistory(hours = 24) {
    const cutoff = Date.now() - hours * 3600000;
    
    const data = [];
    for (let i = 0; i < this.history.timestamps.length; i++) {
      if (this.history.timestamps[i] >= cutoff) {
        data.push({
          timestamp: this.history.timestamps[i],
          price: this.history.prices[i],
          volume: this.history.volumes[i],
        });
      }
    }
    
    return data;
  }
  
  async getAverageVolatility(hours = 24) {
    const history = await this.getVolatilityHistory(hours);
    
    if (history.length < 10) return null;
    
    // Calculate average volatility over history
    const volatility = await this.calculateVolatility(history);
    return volatility;
  }
  
  async isGoodTimeToTrade() {
    const prediction = await this.predict();
    
    return {
      result: prediction.recommendation.action.includes('TRADE'),
      prediction,
    };
  }
  
  async getStatus() {
    const prediction = await this.predict();
    const avgVol = await this.getAverageVolatility(24);
    
    return {
      current: prediction,
      average24h: avgVol ? (avgVol * 100).toFixed(2) : 'N/A',
      history: this.history.timestamps.length,
      recommendation: prediction.recommendation.message,
    };
  }
}

module.exports = { VolatilityPredictor };
