/**
 * Whale Tracker Skill
 * 
 * Monitor large wallet movements and follow smart money.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

class WhaleTracker {
  constructor() {
    this.heliusKey = process.env.HELIUS_API_KEY || '613ad986-5a0b-40c9-a543-f547870938c2';
    this.whaleFile = path.join(__dirname, '../../bots/momentum-sniper/data/whales.json');
    this.activityFile = path.join(__dirname, '../../bots/momentum-sniper/data/whale-activity.json');
    
    // Known smart money wallets (example)
    this.whales = this.loadWhales();
    this.activity = this.loadActivity();
  }
  
  loadWhales() {
    try {
      if (fs.existsSync(this.whaleFile)) {
        return JSON.parse(fs.readFileSync(this.whaleFile, 'utf8'));
      }
    } catch (e) {
      console.log('[whale] No whale file found');
    }
    return {};
  }
  
  loadActivity() {
    try {
      if (fs.existsSync(this.activityFile)) {
        return JSON.parse(fs.readFileSync(this.activityFile, 'utf8'));
      }
    } catch (e) {
      console.log('[whale] No activity file found');
    }
    return [];
  }
  
  saveWhales() {
    try {
      fs.writeFileSync(this.whaleFile, JSON.stringify(this.whales, null, 2));
    } catch (e) {
      console.error('[whale] Failed to save whales:', e.message);
    }
  }
  
  saveActivity() {
    try {
      fs.writeFileSync(this.activityFile, JSON.stringify(this.activity.slice(-1000), null, 2));
    } catch (e) {
      console.error('[whale] Failed to save activity:', e.message);
    }
  }
  
  async trackWallet(address, label = 'Unknown') {
    this.whales[address] = {
      label,
      added: new Date().toISOString(),
      lastChecked: null,
    };
    this.saveWhales();
    
    return {
      success: true,
      message: `🐋 Now tracking: ${label} (${address.slice(0, 8)}...)`,
    };
  }
  
  async untrackWallet(address) {
    if (this.whales[address]) {
      delete this.whales[address];
      this.saveWhales();
      return {
        success: true,
        message: `Stopped tracking: ${address.slice(0, 8)}...`,
      };
    }
    return {
      success: false,
      message: 'Wallet not being tracked',
    };
  }
  
  async getWalletBalance(address) {
    try {
      const response = await axios.post(
        `https://mainnet.helius-rpc.com/?api-key=${this.heliusKey}`,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [address],
        }
      );
      
      return (response.data.result?.value || 0) / 1e9;
    } catch (e) {
      console.error('[whale] Balance check failed:', e.message);
      return null;
    }
  }
  
  async getTokenAccounts(address) {
    try {
      const response = await axios.post(
        `https://mainnet.helius-rpc.com/?api-key=${this.heliusKey}`,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenAccountsByOwner',
          params: {
            owner_str: address,
            program: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          },
        }
      );
      
      return response.data.result?.accounts || [];
    } catch (e) {
      console.error('[whale] Token fetch failed:', e.message);
      return [];
    }
  }
  
  async checkWhales() {
    const updates = [];
    
    for (const [address, data] of Object.entries(this.whales)) {
      const balance = await this.getWalletBalance(address);
      if (balance !== null) {
        const tokens = await this.getTokenAccounts(address);
        
        updates.push({
          address,
          label: data.label,
          balance,
          tokenCount: tokens.length,
          timestamp: new Date().toISOString(),
        });
        
        // Record activity
        this.activity.push({
          address,
          label: data.label,
          balance,
          tokenCount: tokens.length,
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    this.saveActivity();
    return updates;
  }
  
  async getActivity(limit = 20) {
    return this.activity.slice(-limit).reverse();
  }
  
  async getBigBuys(minValue = 1) {
    const bigBuys = this.activity.filter(a => {
      const change = a.balance - (a.previousBalance || a.balance);
      return change > minValue;
    });
    
    return bigBuys;
  }
  
  async getWhaleSignal() {
    const recent = this.activity.slice(-100);
    
    if (recent.length < 5) {
      return { signal: 'NEUTRAL', confidence: 0, message: 'Not enough data' };
    }
    
    // Calculate net flow
    const buys = recent.filter(a => a.balance > (a.previousBalance || 0)).length;
    const sells = recent.filter(a => a.balance < (a.previousBalance || a.balance)).length;
    const net = buys - sells;
    
    // Calculate average balance change
    const avgChange = recent.reduce((sum, a) => {
      return sum + (a.balance - (a.previousBalance || a.balance));
    }, 0) / recent.length;
    
    if (net > 3 && avgChange > 0.5) {
      return {
        signal: 'ACCUMULATING',
        confidence: 75,
        message: `🐋 Whales accumulating (${buys} buys vs ${sells} sells)`,
      };
    } else if (net < -3 && avgChange < -0.5) {
      return {
        signal: 'DISTRIBUTING',
        confidence: 75,
        message: `🐋 Whales distributing (${sells} sells vs ${buys} buys)`,
      };
    }
    
    return {
      signal: 'NEUTRAL',
      confidence: 50,
      message: `Mixed signals (${buys} buys, ${sells} sells)`,
    };
  }
  
  async listTracked() {
    return Object.entries(this.whales).map(([addr, data]) => ({
      address: addr,
      label: data.label,
      added: data.added,
    }));
  }
}

module.exports = { WhaleTracker };
