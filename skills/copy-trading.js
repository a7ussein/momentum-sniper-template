/**
 * Copy Trading Skill
 * 
 * Follow successful wallets and mirror their trades.
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

class CopyTrader {
  constructor() {
    this.dataDir = path.join(__dirname, '../data/copytrading');
    this.trackedFile = path.join(this.dataDir, 'tracked.json');
    this.historyFile = path.join(this.dataDir, 'history.json');
    
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    this.trackedWallets = this.loadTracked();
    this.history = this.loadHistory();
  }
  
  loadTracked() {
    try {
      if (fs.existsSync(this.trackedFile)) {
        return JSON.parse(fs.readFileSync(this.trackedFile, 'utf8'));
      }
    } catch (e) {}
    return {};
  }
  
  loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        return JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
      }
    } catch (e) {}
    return [];
  }
  
  saveTracked() {
    try {
      fs.writeFileSync(this.trackedFile, JSON.stringify(this.trackedWallets, null, 2));
    } catch (e) {}
  }
  
  saveHistory() {
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(this.history.slice(-500), null, 2));
    } catch (e) {}
  }
  
  // Add wallet to track
  async addWallet(name, address) {
    this.trackedWallets[address] = {
      name,
      added: new Date().toISOString(),
      trades: 0,
      pnl: 0,
      status: 'active',
    };
    this.saveTracked();
    return { success: true, name, address };
  }
  
  // Remove wallet
  async removeWallet(address) {
    if (this.trackedWallets[address]) {
      delete this.trackedWallets[address];
      this.saveTracked();
      return { success: true };
    }
    return { success: false, message: 'Wallet not found' };
  }
  
  // Get tracked wallets
  async getTracked() {
    return Object.entries(this.trackedWallets).map(([addr, data]) => ({
      address: addr,
      ...data,
    }));
  }
  
  // Record a trade from tracked wallet
  async recordTrade(walletAddress, token, side, amount, pnl) {
    const trade = {
      wallet: walletAddress,
      token,
      side, // 'buy' or 'sell'
      amount,
      pnl,
      timestamp: new Date().toISOString(),
    };
    
    this.history.push(trade);
    this.saveHistory();
    
    if (this.trackedWallets[walletAddress]) {
      this.trackedWallets[walletAddress].trades++;
      this.trackedWallets[walletAddress].pnl += pnl;
      this.saveTracked();
    }
    
    return trade;
  }
  
  // Get copy opportunities
  async getOpportunities() {
    const opportunities = [];
    
    for (const [addr, data] of Object.entries(this.trackedWallets)) {
      if (data.status !== 'active') continue;
      
      const walletTrades = this.history
        .filter(t => t.wallet === addr && t.side === 'buy')
        .slice(-10);
      
      if (walletTrades.length > 0) {
        const recentBuys = walletTrades.filter(t => t.side === 'buy');
        if (recentBuys.length > 0) {
          opportunities.push({
            wallet: addr,
            name: data.name,
            recentBuys: recentBuys.length,
            avgPnl: recentBuys.reduce((sum, t) => sum + t.pnl, 0) / recentBuys.length,
          });
        }
      }
    }
    
    return opportunities.sort((a, b) => b.avgPnl - a.avgPnl);
  }
  
  // Get performance stats
  async getStats() {
    const trades = this.history.slice(-100);
    const wins = trades.filter(t => t.pnl > 0).length;
    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    
    return {
      totalTrades: trades.length,
      winRate: trades.length > 0 ? (wins / trades.length * 100).toFixed(1) + '%' : 'N/A',
      totalPnl: totalPnl.toFixed(4) + ' SOL',
      trackedWallets: Object.keys(this.trackedWallets).length,
    };
  }
}

module.exports = { CopyTrader };
