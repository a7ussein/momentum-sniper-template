/**
 * Time Optimizer Skill
 * 
 * Find optimal trading times based on historical performance.
 */

const fs = require('fs');
const path = require('path');

class TimeOptimizer {
  constructor() {
    this.dataDir = path.join(__dirname, '../data/time');
    this.historyFile = path.join(this.dataDir, 'performance.json');
    
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    this.performance = this.loadHistory();
    this.initializeBaseline();
  }
  
  loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        return JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
      }
    } catch (e) {
      console.log('[time] No history found');
    }
    return {};
  }
  
  saveHistory() {
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(this.performance, null, 2));
    } catch (e) {
      console.error('[time] Failed to save:', e.message);
    }
  }
  
  initializeBaseline() {
    // Initialize with research-based baselines for Pump.fun trading
    // Based on typical crypto market hours
    const hours = {};
    
    for (let i = 0; i < 24; i++) {
      // US evening (14-18) - typically best volume
      if (i >= 14 && i <= 18) {
        hours[i] = { score: 85, trades: 0, wins: 0, avgReturn: 5 };
      }
      // Asian morning (1-6) - lower volume
      else if (i >= 1 && i <= 6) {
        hours[i] = { score: 45, trades: 0, wins: 0, avgReturn: -2 };
      }
      // European morning (8-12)
      else if (i >= 8 && i <= 12) {
        hours[i] = { score: 65, trades: 0, wins: 0, avgReturn: 2 };
      }
      // Late night (19-24)
      else {
        hours[i] = { score: 55, trades: 0, wins: 0, avgReturn: 0 };
      }
    }
    
    // Merge with existing
    for (const hour of Object.keys(hours)) {
      if (!this.performance[hour]) {
        this.performance[hour] = hours[hour];
      }
    }
    
    this.saveHistory();
  }
  
  recordTrade(hour, won, returnPct) {
    if (!this.performance[hour]) {
      this.performance[hour] = { score: 50, trades: 0, wins: 0, avgReturn: 0 };
    }
    
    this.performance[hour].trades++;
    if (won) this.performance[hour].wins++;
    
    // Update average return
    const old = this.performance[hour].avgReturn;
    this.performance[hour].avgReturn = old + (returnPct - old) / this.performance[hour].trades;
    
    // Update score
    const winRate = this.performance[hour].wins / this.performance[hour].trades;
    this.performance[hour].score = Math.round(winRate * 100);
    
    this.saveHistory();
  }
  
  getHourScore(hour) {
    return this.performance[hour] || { score: 50 };
  }
  
  async getBestHours(limit = 5) {
    const hours = Object.entries(this.performance)
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        ...data,
      }))
      .sort((a, b) => b.score - a.score);
    
    return hours.slice(0, limit);
  }
  
  async getWorstHours(limit = 3) {
    const hours = Object.entries(this.performance)
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        ...data,
      }))
      .sort((a, b) => a.score - b.score);
    
    return hours.slice(0, limit);
  }
  
  async getCurrentHourAnalysis() {
    const hour = new Date().getHours();
    const current = this.performance[hour] || { score: 50, trades: 0 };
    
    const best = await this.getBestHours(3);
    const worst = await this.getWorstHours(3);
    
    const isBestTime = best.some(b => b.hour === hour);
    const isWorstTime = worst.some(w => w.hour === hour);
    
    let recommendation = 'NEUTRAL';
    let message = 'Average trading conditions';
    
    if (current.score >= 70) {
      recommendation = 'EXCELLENT';
      message = 'One of the best times to trade';
    } else if (current.score >= 55) {
      recommendation = 'GOOD';
      message = 'Favorable conditions';
    } else if (current.score < 40) {
      recommendation = 'POOR';
      message = 'Avoid trading if possible';
    }
    
    return {
      currentHour: hour,
      score: current.score,
      tradesToday: current.trades,
      winRate: current.trades > 0 ? Math.round(current.wins / current.trades * 100) + '%' : 'N/A',
      avgReturn: current.avgReturn.toFixed(2) + '%',
      recommendation,
      message,
      isBestTime,
      isWorstTime,
      bestHours: best,
      worstHours: worst,
    };
  }
  
  async getRecommendation() {
    const analysis = await this.getCurrentHourAnalysis();
    
    if (analysis.recommendation === 'EXCELLENT' || analysis.recommendation === 'GOOD') {
      return {
        action: 'TRADE',
        confidence: analysis.score,
        message: analysis.message,
        details: analysis,
      };
    }
    
    if (analysis.recommendation === 'POOR') {
      return {
        action: 'AVOID',
        confidence: 100 - analysis.score,
        message: analysis.message,
        details: analysis,
      };
    }
    
    return {
      action: 'CAUTION',
      confidence: 50,
      message: 'Average conditions - proceed carefully',
      details: analysis,
    };
  }
  
  async getStatus() {
    const analysis = await this.getCurrentHourAnalysis();
    const best = await this.getBestHours(24);
    const totalTrades = Object.values(this.performance).reduce((sum, h) => sum + h.trades, 0);
    
    return {
      current: analysis,
      totalRecordedTrades: totalTrades,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { TimeOptimizer };
