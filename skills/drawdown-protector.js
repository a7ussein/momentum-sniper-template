/**
 * Drawdown Protector Skill
 * 
 * Hard stop losses to protect capital.
 */

const fs = require('fs');
const path = require('path');

class DrawdownProtector {
  constructor() {
    this.dataDir = path.join(__dirname, '../data/protector');
    this.stateFile = path.join(this.stateDir, 'state.json');
    this.stateDir = path.join(__dirname, '../data/protector');
    
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    this.state = this.loadState();
  }
  
  loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        return JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      }
    } catch (e) {
      console.log('[protector] No state found');
    }
    return {
      enabled: true,
      maxDailyDrawdown: 10, // Stop at 10% daily loss
      maxTotalDrawdown: 30, // Stop at 30% total loss
      peakBalance: 0.1, // Starting balance reference
      currentDrawdown: 0,
      dailyLoss: 0,
      pauseUntil: null,
      totalPauses: 0,
      history: [],
    };
  }
  
  saveState() {
    try {
      fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
    } catch (e) {
      console.error('[protector] Failed to save:', e.message);
    }
  }
  
  async enable() {
    this.state.enabled = true;
    this.saveState();
    return { success: true, message: 'Drawdown protection enabled' };
  }
  
  async disable() {
    this.state.enabled = false;
    this.saveState();
    return { success: true, message: 'Drawdown protection disabled' };
  }
  
  async setMaxDailyDrawdown(percent) {
    this.state.maxDailyDrawdown = percent;
    this.saveState();
    return { success: true, maxDailyDrawdown: percent + '%' };
  }
  
  async setMaxTotalDrawdown(percent) {
    this.state.maxTotalDrawdown = percent;
    this.saveState();
    return { success: true, maxTotalDrawdown: percent + '%' };
  }
  
  // Update peak balance reference
  async updatePeakBalance(balance) {
    if (balance > this.state.peakBalance) {
      this.state.peakBalance = balance;
      this.saveState();
    }
  }
  
  // Check drawdown after each trade
  async checkDrawdown(currentBalance, todayLoss) {
    if (!this.state.enabled) {
      return { allowed: true };
    }
    
    // Check if paused
    if (this.state.pauseUntil && new Date() < new Date(this.state.pauseUntil)) {
      return {
        allowed: false,
        reason: 'PAUSED',
        message: `Paused until ${this.state.pauseUntil}`,
        remaining: Math.ceil((new Date(this.state.pauseUntil) - new Date()) / 60000) + ' min',
      };
    }
    
    // Calculate drawdown
    const totalDrawdown = ((this.state.peakBalance - currentBalance) / this.state.peakBalance) * 100;
    this.state.currentDrawdown = totalDrawdown;
    
    // Check limits
    if (totalDrawdown >= this.state.maxTotalDrawdown) {
      await this.triggerPause('MAX_TOTAL_DRAWDOWN', totalDrawdown);
      return {
        allowed: false,
        reason: 'MAX_TOTAL_DRAWDOWN',
        message: `Total drawdown ${totalDrawdown.toFixed(1)}% exceeds limit`,
      };
    }
    
    if (todayLoss >= this.state.maxDailyDrawdown) {
      await this.triggerPause('MAX_DAILY_LOSS', todayLoss);
      return {
        allowed: false,
        reason: 'MAX_DAILY_LOSS',
        message: `Daily loss ${todayLoss.toFixed(1)}% exceeds limit`,
      };
    }
    
    return {
      allowed: true,
      currentDrawdown: totalDrawdown.toFixed(2) + '%',
      dailyLoss: todayLoss.toFixed(2) + '%',
    };
  }
  
  async triggerPause(reason, value) {
    this.state.pauseUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour pause
    this.state.totalPauses++;
    this.state.history.push({
      reason,
      value,
      timestamp: new Date().toISOString(),
      pauseUntil: this.state.pauseUntil,
    });
    if (this.state.history.length > 50) {
      this.state.history = this.state.history.slice(-50);
    }
    this.saveState();
    
    console.log(`[protector] ⚠️ PAUSED: ${reason} (${value}%)`);
  }
  
  async resetDay() {
    this.state.dailyLoss = 0;
    this.state.pauseUntil = null;
    this.saveState();
    return { success: true, message: 'Daily stats reset' };
  }
  
  async getStatus() {
    const now = new Date();
    const isPaused = this.state.pauseUntil && new Date(this.state.pauseUntil) > now;
    
    return {
      enabled: this.state.enabled,
      isPaused,
      pauseUntil: isPaused ? this.state.pauseUntil : null,
      limits: {
        maxDailyDrawdown: this.state.maxDailyDrawdown + '%',
        maxTotalDrawdown: this.state.maxTotalDrawdown + '%',
      },
      current: {
        peakBalance: this.state.peakBalance.toFixed(4) + ' SOL',
        currentDrawdown: this.state.currentDrawdown.toFixed(2) + '%',
        dailyLoss: this.state.dailyLoss.toFixed(2) + '%',
      },
      stats: {
        totalPauses: this.state.totalPauses,
      },
      recentPauses: this.state.history.slice(-5).reverse(),
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { DrawdownProtector };
