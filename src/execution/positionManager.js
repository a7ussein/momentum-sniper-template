/**
 * Position Manager
 * 
 * Manages open positions with:
 * - Tiered exits (+50%, +100%)
 * - Stop loss (-15%)
 * - Time decay
 * - Fee monitoring
 */

const EventEmitter = require('events');
const config = require('../../config');

class PositionManager extends EventEmitter {
  constructor({ rpc, wallet }) {
    super();
    this.rpc = rpc;
    this.wallet = wallet;
    
    // Open positions
    this.positions = new Map(); // mint -> position
    
    // Daily stats
    this.dailyStats = {
      date: new Date().toISOString().split('T')[0],
      trades: [],
      totalPnL: 0,
      wins: 0,
      losses: 0,
      aborted: 0,
    };
    
    // Start monitoring loop
    this._startMonitoring();
  }

  _startMonitoring() {
    // Monitor positions every 2 seconds
    setInterval(() => this._checkPositions(), 2000).unref?.();
    
    // Daily reset check
    setInterval(() => this._checkDailyReset(), 60000).unref?.();
  }

  async openPosition({ mint, entryPrice, tokens, solInvested, signal }) {
    const { maxPositions, dailyLossLimitPct } = config.trading;
    
    // Check max positions
    if (this.positions.size >= maxPositions) {
      console.log('[position] max positions reached');
      return null;
    }
    
    // Check daily loss limit
    if (this._isDailyLossLimitHit(dailyLossLimitPct)) {
      console.log('[position] daily loss limit hit - blocking new entries');
      this.emit('circuitBreaker', { reason: 'DAILY_LOSS_LIMIT' });
      return null;
    }

    const position = {
      mint,
      entryPrice,
      entryTime: Date.now(),
      tokens,
      solInvested,
      signal,
      
      // State
      state: 'IN_POSITION', // IN_POSITION, TIER_1_EXITED, CLOSED, STOPPED
      
      // Tracking
      entrySlot: await this._getCurrentSlot(),
      lastCheckTime: Date.now(),
      
      // Exit tracking
      tier1Exited: false,
      tier2Exited: false,
      remainingTokens: tokens,
      realizedPnL: 0,
    };

    this.positions.set(mint, position);
    
    console.log('[position] opened:', {
      mint,
      solInvested,
      tokens,
      entryPrice,
    });
    
    this.emit('opened', position);
    
    return position;
  }

  async _checkPositions() {
    for (const [mint, position] of this.positions) {
      if (position.state === 'CLOSED' || position.state === 'STOPPED') {
        continue;
      }

      try {
        await this._evaluatePosition(mint, position);
      } catch (e) {
        console.error('[position] check error:', mint, e.message);
      }
    }
  }

  async _evaluatePosition(mint, position) {
    const { exit } = config;
    const now = Date.now();
    
    // Get current price from curve data
    let currentPrice = null;
    if (position.signal?.curveData?.virtualSol && position.signal?.curveData?.virtualToken) {
      const virtualSol = BigInt(position.signal.curveData.virtualSol);
      const virtualToken = BigInt(position.signal.curveData.virtualToken);
      if (virtualToken > 0n) {
        currentPrice = Number(virtualSol) / Number(virtualToken);
      }
    }
    
    if (!currentPrice) return;

    // Calculate PnL correctly
    // entryPrice = SOL invested / tokens received
    // So PnL = (currentPrice - entryPrice) / entryPrice * 100
    const pnlPct = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
    
    // Update position
    position.currentPrice = currentPrice;
    position.pnlPct = pnlPct;
    position.lastCheckTime = now;

    // === Check Tier 1 Exit (+50% to +100%) ===
    if (exit.tier1.enabled && !position.tier1Exited && position.state === 'IN_POSITION') {
      if (pnlPct >= exit.tier1.minPct && pnlPct <= exit.tier1.maxPct) {
        console.log('[position] 🎯 TIER 1 EXIT:', {
          mint,
          pnlPct: pnlPct.toFixed(2),
          exitReason: 'TIER_1_PROFIT',
        });
        
        await this._executePartialExit(position, exit.tier1.exitPct, 'TIER_1_PROFIT');
        position.tier1Exited = true;
        position.state = 'TIER_1_EXITED';
        return;
      }
    }

    // === Check Tier 2 Exit (+100%+, parabolic) ===
    if (exit.tier2.enabled && !position.tier2Exited) {
      if (pnlPct >= exit.tier2.minPct) {
        // Check for parabolic move
        const recentChange = await this._checkParabolicMove(position);
        
        if (recentChange > 20) { // 20% move in short window
          console.log('[position] 🚀 TIER 2 EXIT (parabolic):', {
            mint,
            pnlPct: pnlPct.toFixed(2),
          });
          
          await this._executeFullExit(position, 'TIER_2_PROFIT');
          return;
        }
      }
    }

    // === Check Stop Loss ===
    if (exit.stopLoss.enabled) {
      if (pnlPct <= exit.stopLoss.pct) {
        console.log('[position] 🛑 STOP LOSS:', {
          mint,
          pnlPct: pnlPct.toFixed(2),
        });
        
        await this._executeFullExit(position, 'STOP_LOSS');
        return;
      }
    }

    // === Check Time Decay ===
    if (exit.timeDecay.enabled) {
      const slotsHeld = await this._getCurrentSlot() - position.entrySlot;
      
      if (slotsHeld > exit.timeDecay.maxSlots) {
        const shouldExit = !exit.timeDecay.requireProfit || pnlPct > 0;
        
        if (shouldExit) {
          console.log('[position] ⏰ TIME DECAY EXIT:', {
            mint,
            pnlPct: pnlPct.toFixed(2),
            slotsHeld,
          });
          
          await this._executeFullExit(position, 'TIME_DECAY');
          return;
        }
      }
    }

    // === Check Fee Balance (dump detection) ===
    const feeCheck = await this._checkFeeBalance(mint);
    if (feeCheck.dumpRisk === 'HIGH' && exit.feeSpikeExit) {
      console.log('[position] ⚠️ FEE SPIKE EXIT:', {
        mint,
        feeBalance: feeCheck.feeBalance,
        feeChange: feeCheck.feeChange5m,
      });
      
      await this._executeFullExit(position, 'FEE_SPIKE');
      return;
    }
  }

  async _executePartialExit(position, exitPct, reason) {
    const tokensToExit = Math.floor(position.remainingTokens * exitPct);
    
    if (tokensToExit <= 0) return;

    console.log('[position] executing partial exit:', {
      mint: position.mint,
      exitPct,
      tokensToExit,
    });

    // In real implementation, would call sell()
    const exitValue = (position.solInvested * exitPct) * (1 + position.pnlPct / 100);
    
    position.remainingTokens -= tokensToExit;
    position.realizedPnL += exitValue * (position.pnlPct / 100) * exitPct;
    
    this._recordTrade({
      mint: position.mint,
      type: 'PARTIAL',
      reason,
      exitPct,
      tokens: tokensToExit,
      pnlPct: position.pnlPct,
      timestamp: Date.now(),
    });

    this.emit('partialExit', { position, exitPct, reason });
  }

  async _executeFullExit(position, reason) {
    console.log('[position] executing full exit:', {
      mint: position.mint,
      reason,
      pnlPct: position.pnlPct?.toFixed(2),
    });

    const finalPnLPct = position.pnlPct;
    const isWin = finalPnLPct > 0;

    // Update daily stats
    this.dailyStats.trades.push({
      mint: position.mint,
      entryPrice: position.entryPrice,
      exitPrice: position.currentPrice,
      solInvested: position.solInvested,
      pnlPct: finalPnLPct,
      reason,
      durationMs: Date.now() - position.entryTime,
      timestamp: Date.now(),
    });

    if (isWin) {
      this.dailyStats.wins++;
    } else {
      this.dailyStats.losses++;
    }

    // Calculate total PnL
    const tradePnL = position.solInvested * (finalPnLPct / 100);
    this.dailyStats.totalPnL += tradePnL;

    // Update position state
    position.state = reason === 'STOP_LOSS' ? 'STOPPED' : 'CLOSED';
    position.exitReason = reason;
    position.exitTime = Date.now();
    
    // Remove from active positions
    this.positions.delete(position.mint);

    console.log('[position] closed:', {
      mint: position.mint,
      pnlPct: finalPnLPct.toFixed(2),
      dailyPnL: this.dailyStats.totalPnL.toFixed(4),
    });

    this.emit('closed', { position, reason });
  }

  async _getCurrentPrice(mint) {
    // Use stored curve data if available
    const position = this.positions.get(mint);
    if (!position) return null;
    
    // If we have curve data, calculate real price
    if (position.signal?.curveData?.virtualSol && position.signal?.curveData?.virtualToken) {
      const virtualSol = BigInt(position.signal.curveData.virtualSol);
      const virtualToken = BigInt(position.signal.curveData.virtualToken);
      
      if (virtualToken > 0n) {
        // Price = virtualSol / virtualToken (in SOL per token)
        return Number(virtualSol) / Number(virtualToken);
      }
    }
    
    // Fallback: use entry price with small drift
    const drift = (Math.random() - 0.5) * 0.01; // ±0.5% per check
    return position.entryPrice * (1 + drift);
  }

  async _getCurrentSlot() {
    try {
      const slot = await this.rpc('getSlot');
      return slot;
    } catch (e) {
      return 0;
    }
  }

  async _checkParabolicMove(position) {
    // Simplified: check if price increased >20% in last 30 seconds
    // In reality, would track price history
    return Math.random() * 30;
  }

  async _checkFeeBalance(mint) {
    // Simplified: would fetch actual fee balance from Pump.fun contract
    return {
      feeBalance: 0,
      feeChange5m: 0,
      dumpRisk: 'LOW',
    };
  }

  _isDailyLossLimitHit(limitPct) {
    if (this.dailyStats.totalPnL >= 0) return false;
    
    const lossPct = (Math.abs(this.dailyStats.totalPnL) / 100) * 100; // Simplified
    return lossPct >= limitPct;
  }

  _checkDailyReset() {
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.dailyStats.date) {
      console.log('[position] daily reset:', {
        yesterday: this.dailyStats,
      });
      
      this.dailyStats = {
        date: today,
        trades: [],
        totalPnL: 0,
        wins: 0,
        losses: 0,
        aborted: 0,
      };
    }
  }

  _recordTrade(trade) {
    this.dailyStats.trades.push(trade);
    if (trade.pnlPct < 0) {
      this.dailyStats.aborted++;
    }
  }

  getStats() {
    return {
      openPositions: this.positions.size,
      dailyStats: { ...this.dailyStats },
      positions: Array.from(this.positions.values()).map(p => ({
        mint: p.mint,
        state: p.state,
        pnlPct: p.pnlPct?.toFixed(2),
        durationMs: Date.now() - p.entryTime,
      })),
    };
  }

  getOpenPositions() {
    return Array.from(this.positions.values());
  }
}

module.exports = { PositionManager };
