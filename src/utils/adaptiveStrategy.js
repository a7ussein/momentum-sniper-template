/**
 * Adaptive Strategy Manager
 * 
 * Automatically adjusts trading strategy based on market conditions
 * and learned experience.
 */

const { MarketHealthMonitor } = require('./marketHealth');
const { LearningMemory } = require('./learningMemory');

class AdaptiveStrategyManager {
  constructor() {
    this.marketHealth = new MarketHealthMonitor();
    this.memory = new LearningMemory();
    
    this.currentStrategy = 'BALANCED';
    this.tradesToday = 0;
    this.winsToday = 0;
    this.lossesToday = 0;
    
    this.strategyConfigs = {
      AGGRESSIVE: {
        minScore: 60,
        maxPositions: 5,
        positionSize: 0.01,
        stopLoss: -15,
        takeProfit1: 50,
        takeProfit2: 100,
      },
      BALANCED: {
        minScore: 70,
        maxPositions: 3,
        positionSize: 0.005,
        stopLoss: -15,
        takeProfit1: 50,
        takeProfit2: 100,
      },
      CONSERVATIVE: {
        minScore: 80,
        maxPositions: 2,
        positionSize: 0.002,
        stopLoss: -10,
        takeProfit1: 30,
        takeProfit2: 75,
      },
      PAUSE: {
        minScore: 95,
        maxPositions: 1,
        positionSize: 0.001,
        stopLoss: -5,
        takeProfit1: 20,
        takeProfit2: 50,
      },
    };
  }
  
  async onTradeEnter(tokenData) {
    this.tradesToday++;
    console.log(`[strategy] Trade #${this.tradesToday} entered with ${this.currentStrategy} strategy`);
  }
  
  async onTradeExit(result) {
    const { won, pnlPct, tokenData } = result;
    
    if (won) {
      this.winsToday++;
    } else {
      this.lossesToday++;
    }
    
    // Record for market health
    this.marketHealth.recordTrade({ win: won, pnlPct });
    
    // Record for memory
    const message = won 
      ? `Trade won: +${pnlPct.toFixed(1)}% on ${tokenData.mint?.slice(0, 8)}`
      : `Trade lost: ${pnlPct.toFixed(1)}% on ${tokenData.mint?.slice(0, 8)}`;
    
    this.memory.recordStrategyResult(this.currentStrategy, won);
    
    // Check if we need to adapt
    await this.checkAndAdapt();
  }
  
  async checkAndAdapt() {
    const health = this.marketHealth.getStatus();
    const oldStrategy = this.currentStrategy;
    
    // Get recommended strategy from market health
    const recommended = health.recommended.mode;
    
    // Also consider learned experience
    const bestLearned = this.memory.getBestStrategy();
    
    // Override with learned strategy if it's performing well
    if (bestLearned && bestLearned.winRate > 0.6) {
      // Use the learned strategy with market conditions
      console.log(`[strategy] Learned ${bestLearned.strategy} has ${(bestLearned.winRate * 100).toFixed(0)}% win rate`);
    }
    
    // Switch strategy if recommended differs
    if (recommended !== oldStrategy) {
      this.switchStrategy(recommended);
    }
  }
  
  switchStrategy(newStrategy) {
    const old = this.currentStrategy;
    this.currentStrategy = newStrategy;
    
    const config = this.getConfig();
    
    console.log(`[strategy] 🔄 SWITCHING: ${old} → ${newStrategy}`);
    console.log(`[strategy] New config: score≥${config.minScore}, positions≤${config.maxPositions}, size=${config.positionSize}`);
    
    // Record the change as a lesson
    this.memory.addLesson(`Switched from ${old} to ${newStrategy} strategy due to market conditions`);
  }
  
  getConfig() {
    return this.strategyConfigs[this.currentStrategy] || this.strategies.BALANCED;
  }
  
  getStatus() {
    return {
      currentStrategy: this.currentStrategy,
      config: this.getConfig(),
      marketHealth: this.marketHealth.getStatus(),
      todayStats: {
        trades: this.tradesToday,
        wins: this.winsToday,
        losses: this.lossesToday,
        winRate: this.tradesToday > 0 
          ? (this.winsToday / this.tradesToday * 100).toFixed(1) + '%' 
          : 'N/A',
      },
      advice: this.memory.getAdvice(),
      bestStrategy: this.memory.getBestStrategy(),
    };
  }
  
  resetDaily() {
    this.tradesToday = 0;
    this.winsToday = 0;
    this.lossesToday = 0;
    
    // Save daily stats
    this.memory.recordDay({
      trades: this.tradesToday,
      wins: this.winsToday,
      losses: this.lossesToday,
      strategy: this.currentStrategy,
    });
  }
}

module.exports = { AdaptiveStrategyManager };
