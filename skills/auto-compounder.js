/**
 * Auto-Compounder Skill
 * 
 * Automatically reinvest profits to compound gains.
 */

const fs = require('fs');
const path = require('path');

class AutoCompounder {
  constructor() {
    this.dataDir = path.join(__dirname, '../data/compounder');
    this.stateFile = path.join(this.stateDir, 'state.json');
    this.stateDir = path.join(__dirname, '../data/compounder');
    
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
      console.log('[compounder] No state found');
    }
    return {
      enabled: false,
      threshold: 10, // Reinvest when profit > 10%
      compoundPercent: 50, // Compound 50% of profits
      minCompound: 0.005, // Min SOL to compound
      totalCompounds: 0,
      totalCompounded: 0,
      history: [],
    };
  }
  
  saveState() {
    try {
      fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
    } catch (e) {
      console.error('[compounder] Failed to save:', e.message);
    }
  }
  
  async enable() {
    this.state.enabled = true;
    this.saveState();
    return { success: true, message: 'Auto-compounder enabled' };
  }
  
  async disable() {
    this.state.enabled = false;
    this.saveState();
    return { success: true, message: 'Auto-compounder disabled' };
  }
  
  async setThreshold(percent) {
    this.state.threshold = percent;
    this.saveState();
    return { success: true, threshold: percent };
  }
  
  async setCompoundPercent(percent) {
    this.state.compoundPercent = percent;
    this.saveState();
    return { success: true, compoundPercent: percent };
  }
  
  // Called when a position closes
  async onPositionClose(mint, profitPct, solProfit) {
    if (!this.state.enabled) {
      return { compounded: false, reason: 'Disabled' };
    }
    
    // Check if profit exceeds threshold
    if (profitPct < this.state.threshold) {
      return { compounded: false, reason: 'Profit below threshold' };
    }
    
    // Calculate compound amount
    const compoundAmount = Math.max(
      this.state.minCompound,
      solProfit * (this.state.compoundPercent / 100)
    );
    
    // Record compound
    this.state.totalCompounds++;
    this.state.totalCompounded += compoundAmount;
    this.state.history.push({
      mint,
      profitPct,
      solProfit,
      compoundAmount,
      timestamp: new Date().toISOString(),
    });
    
    if (this.state.history.length > 100) {
      this.state.history = this.state.history.slice(-100);
    }
    
    this.saveState();
    
    return {
      compounded: true,
      compoundAmount,
      message: `Compounded ${compoundAmount.toFixed(4)} SOL (${this.state.compoundPercent}% of profit)`,
    };
  }
  
  async getStatus() {
    return {
      enabled: this.state.enabled,
      settings: {
        threshold: this.state.threshold + '%',
        compoundPercent: this.state.compoundPercent + '%',
        minCompound: this.state.minCompound + ' SOL',
      },
      stats: {
        totalCompounds: this.state.totalCompounds,
        totalCompounded: this.state.totalCompounded.toFixed(4) + ' SOL',
      },
      recent: this.state.history.slice(-5).reverse(),
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { AutoCompounder };
