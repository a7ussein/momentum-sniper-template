/**
 * Market Health Monitor
 * 
 * Tracks market conditions and adjusts strategy automatically.
 */

class MarketHealthMonitor {
  constructor() {
    this.stats = {
      trades: 0,
      wins: 0,
      losses: 0,
      recentTrades: [], // Last 20 trades
    };
    
    this.thresholds = {
      goodMarketWinRate: 0.5,
      badMarketWinRate: 0.3,
      pauseWinRate: 0.2,
    };
    
    this.currentState = 'NEUTRAL'; // NEUTRAL, GOOD, BAD, CRITICAL
  }
  
  recordTrade(result) {
    const { win } = result;
    
    this.stats.trades++;
    if (win) {
      this.stats.wins++;
    } else {
      this.stats.losses++;
    }
    
    // Track recent trades
    this.stats.recentTrades.push(win);
    if (this.stats.recentTrades.length > 20) {
      this.stats.recentTrades.shift();
    }
    
    this.updateState();
  }
  
  getWinRate() {
    if (this.stats.trades === 0) return 0.5;
    return this.stats.wins / this.stats.trades;
  }
  
  getRecentWinRate() {
    if (this.stats.recentTrades.length < 5) return 0.5;
    const recent = this.stats.recentTrades.slice(-10);
    const wins = recent.filter(w => w).length;
    return wins / recent.length;
  }
  
  updateState() {
    const recentWinRate = this.getRecentWinRate();
    const overallWinRate = this.getWinRate();
    
    if (recentWinRate < this.thresholds.pauseWinRate) {
      this.currentState = 'CRITICAL';
    } else if (recentWinRate < this.thresholds.badMarketWinRate) {
      this.currentState = 'BAD';
    } else if (recentWinRate > this.thresholds.goodMarketWinRate && overallWinRate > 0.4) {
      this.currentState = 'GOOD';
    } else {
      this.currentState = 'NEUTRAL';
    }
  }
  
  getRecommendedStrategy() {
    switch (this.currentState) {
      case 'CRITICAL':
        return {
          mode: 'PAUSE',
          minScore: 90,
          maxPositions: 1,
          positionSize: 0.001,
          message: 'Market critical - pausing or tiny positions only'
        };
      case 'BAD':
        return {
          mode: 'CONSERVATIVE',
          minScore: 80,
          maxPositions: 2,
          positionSize: 0.002,
          message: 'Bad market - very selective'
        };
      case 'GOOD':
        return {
          mode: 'AGGRESSIVE',
          minScore: 60,
          maxPositions: 5,
          positionSize: 0.01,
          message: 'Good market - full speed'
        };
      default:
        return {
          mode: 'BALANCED',
          minScore: 70,
          maxPositions: 3,
          positionSize: 0.005,
          message: 'Neutral - balanced approach'
        };
    }
  }
  
  getStatus() {
    return {
      state: this.currentState,
      winRate: this.getWinRate(),
      recentWinRate: this.getRecentWinRate(),
      totalTrades: this.stats.trades,
      wins: this.stats.wins,
      losses: this.stats.losses,
      recommended: this.getRecommendedStrategy(),
    };
  }
}

module.exports = { MarketHealthMonitor };
