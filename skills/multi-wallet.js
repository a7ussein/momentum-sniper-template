/**
 * Multi-Wallet Manager Skill
 * 
 * Manage multiple wallets with different strategies.
 */

const fs = require('fs');
const path = require('path');

class MultiWalletManager {
  constructor() {
    this.dataDir = path.join(__dirname, '../data/wallets');
    this.walletsFile = path.join(this.dataDir, 'wallets.json');
    
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    this.wallets = this.loadWallets();
  }
  
  loadWallets() {
    try {
      if (fs.existsSync(this.walletsFile)) {
        return JSON.parse(fs.readFileSync(this.walletsFile, 'utf8'));
      }
    } catch (e) {
      console.log('[wallets] No wallets found');
    }
    return {};
  }
  
  saveWallets() {
    try {
      fs.writeFileSync(this.walletsFile, JSON.stringify(this.wallets, null, 2));
    } catch (e) {
      console.error('[wallets] Failed to save:', e.message);
    }
  }
  
  async addWallet(name, address, strategy = 'BALANCED', allocation = 100) {
    this.wallets[name] = {
      address,
      strategy,
      allocation,
      enabled: true,
      added: new Date().toISOString(),
      stats: {
        trades: 0,
        wins: 0,
        losses: 0,
        totalPnL: 0,
      },
    };
    this.saveWallets();
    
    return { success: true, name, address, strategy };
  }
  
  async removeWallet(name) {
    if (this.wallets[name]) {
      delete this.wallets[name];
      this.saveWallets();
      return { success: true, name };
    }
    return { success: false, message: 'Wallet not found' };
  }
  
  async setStrategy(name, strategy) {
    if (this.wallets[name]) {
      this.wallets[name].strategy = strategy;
      this.saveWallets();
      return { success: true, name, strategy };
    }
    return { success: false, message: 'Wallet not found' };
  }
  
  async setAllocation(name, allocation) {
    if (this.wallets[name]) {
      this.wallets[name].allocation = allocation;
      this.saveWallets();
      return { success: true, name, allocation };
    }
    return { success: false, message: 'Wallet not found' };
  }
  
  async getWallet(name) {
    return this.wallets[name] || null;
  }
  
  async listWallets() {
    return Object.entries(this.wallets).map(([name, data]) => ({
      name,
      ...data,
      address: data.address.slice(0, 8) + '...',
    }));
  }
  
  async getActiveWallets() {
    return Object.entries(this.wallets)
      .filter(([_, data]) => data.enabled)
      .map(([name, data]) => ({
        name,
        ...data,
        address: data.address.slice(0, 8) + '...',
      }));
  }
  
  // Get wallet for a trade based on allocation
  async getWalletForTrade(totalCapital) {
    const active = await this.getActiveWallets();
    if (active.length === 0) return null;
    
    // Simple round-robin or proportional allocation
    const wallet = active[Math.floor(Math.random() * active.length)];
    const allocation = wallet.allocation / 100;
    const positionSize = totalCapital * allocation;
    
    return {
      name: wallet.name,
      address: wallet.address,
      strategy: wallet.strategy,
      positionSize,
    };
  }
  
  // Record trade result for wallet
  async recordTradeResult(name, won, pnl) {
    if (this.wallets[name]) {
      this.wallets[name].stats.trades++;
      if (won) this.wallets[name].stats.wins++;
      else this.wallets[name].stats.losses++;
      this.wallets[name].stats.totalPnL += pnl;
      this.saveWallets();
    }
  }
  
  async getStatus() {
    const wallets = await this.listWallets();
    const active = wallets.filter(w => w.enabled);
    const totalAllocated = active.reduce((sum, w) => sum + w.allocation, 0);
    
    return {
      totalWallets: wallets.length,
      activeWallets: active.length,
      totalAllocated: totalAllocated + '%',
      wallets: active.map(w => ({
        name: w.name,
        strategy: w.strategy,
        allocation: w.allocation + '%',
        trades: w.stats.trades,
        winRate: w.stats.trades > 0 
          ? Math.round(w.stats.wins / w.stats.trades * 100) + '%' 
          : 'N/A',
        totalPnL: w.stats.totalPnL.toFixed(4) + ' SOL',
      })),
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { MultiWalletManager };
