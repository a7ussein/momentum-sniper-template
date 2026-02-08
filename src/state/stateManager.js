/**
 * State Persistence & Crash Recovery
 * 
 * Handles:
 * - Periodic snapshots
 * - Write-ahead log (WAL)
 * - Recovery on startup
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const config = require('../../config');

class StateManager {
  constructor({ dataDir = './data' } = {}) {
    this.dataDir = dataDir;
    this.state = null;
    this.wal = [];
    this.snapshotTimer = null;
    this.walTimer = null;
    
    // Ensure data directory exists
    this._init();
  }

  async _init() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(path.join(this.dataDir, 'snapshots'), { recursive: true });
    await fs.mkdir(path.join(this.dataDir, 'wal'), { recursive: true });
  }

  /**
   * Initialize state for a new session
   */
  async initialize(initialState = {}) {
    this.state = {
      version: '1.0.0',
      timestamp: Date.now(),
      ...initialState,
      
      // Scanner state
      scanner: {
        seenMints: new Map(),
        completedMints: new Set(),
        ...(initialState.scanner || {}),
      },
      
      // Position state
      positions: new Map(),
      
      // Daily stats
      dailyStats: {
        date: new Date().toISOString().split('T')[0],
        trades: [],
        totalPnL: 0,
        wins: 0,
        losses: 0,
        aborted: 0,
        ...(initialState.dailyStats || {}),
      },
      
      // Runtime config
      config: config,
    };

    // Start periodic snapshots
    this._startSnapshotSchedule();
    
    // Start WAL flush timer
    if (config.persistence.useWal) {
      this._startWalSchedule();
    }

    console.log('[state] initialized');
    return this.state;
  }

  /**
   * Load state from last snapshot + WAL replay
   */
  async load() {
    const snapshot = await this._loadLatestSnapshot();
    
    if (!snapshot) {
      console.log('[state] no snapshot found, starting fresh');
      return null;
    }

    this.state = snapshot.state;
    
    // Ensure positions is always a Map
    if (!this.state.positions || typeof this.state.positions.set !== 'function') {
      this.state.positions = new Map(Object.entries(this.state.positions || {}));
    }
    
    // Ensure scanner.seenMints is a Map
    if (!this.state.scanner.seenMints || typeof this.state.scanner.seenMints.set !== 'function') {
      this.state.scanner.seenMints = new Map(Object.entries(this.state.scanner?.seenMints || {}));
    }
    
    // Ensure scanner.completedMints is a Set
    if (!this.state.scanner.completedMints || !(this.state.scanner.completedMints instanceof Set)) {
      this.state.scanner.completedMints = new Set(this.state.scanner?.completedMints || []);
    }
    
    // Replay WAL
    if (config.persistence.useWal) {
      await this._replayWal(snapshot.walOffset);
    }

    console.log('[state] recovered from snapshot:', {
      positions: this.state.positions.size,
      trades: this.state.dailyStats?.trades?.length || 0,
    });

    return this.state;
  }

  /**
   * Get current state
   */
  getState() {
    return this.state;
  }

  /**
   * Update scanner seen mints
   */
  addSeenMint(mint, data) {
    this.state.scanner.seenMints.set(mint, {
      ...data,
      timestamp: Date.now(),
    });
    
    this._walAppend({
      type: 'MINT_SEEN',
      mint,
      data,
      timestamp: Date.now(),
    });
  }

  hasSeenMint(mint) {
    return this.state.scanner.seenMints.has(mint);
  }

  /**
   * Add position
   */
  addPosition(mint, position) {
    this.state.positions.set(mint, {
      ...position,
      state: 'IN_POSITION',
    });
    
    this._walAppend({
      type: 'POSITION_OPENED',
      mint,
      position,
      timestamp: Date.now(),
    });
  }

  /**
   * Update position
   */
  updatePosition(mint, updates) {
    const position = this.state.positions.get(mint);
    if (position) {
      Object.assign(position, updates);
      
      this._walAppend({
        type: 'POSITION_UPDATED',
        mint,
        updates,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Close position
   */
  closePosition(mint, result) {
    const position = this.state.positions.get(mint);
    if (position) {
      position.state = 'CLOSED';
      position.exitResult = result;
      
      // Move to completed trades
      this.state.dailyStats.trades.push({
        ...position,
        ...result,
        closedAt: Date.now(),
      });
      
      // Update stats
      if (result.pnlPct > 0) {
        this.state.dailyStats.wins++;
      } else {
        this.state.dailyStats.losses++;
      }
      this.state.dailyStats.totalPnL += result.pnlPct || 0;
      
      // Remove from active positions
      this.state.positions.delete(mint);
      
      this._walAppend({
        type: 'POSITION_CLOSED',
        mint,
        result,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Add signal to history
   */
  addSignal(signal) {
    if (!this.state.signals) {
      this.state.signals = [];
    }
    
    this.state.signals.push({
      ...signal,
      timestamp: Date.now(),
    });

    // Keep only last 1000 signals
    if (this.state.signals.length > 1000) {
      this.state.signals = this.state.signals.slice(-1000);
    }
  }

  /**
   * Take a snapshot
   */
  async takeSnapshot() {
    if (!this.state) {
      console.log('[state] no state to snapshot');
      return;
    }

    const snapshot = {
      version: '1.0.0',
      timestamp: Date.now(),
      stateHash: await this._hashState(this.state),
      walOffset: this.wal.length,
      state: {
        ...this.state,
        // Convert Maps/Sets to serializable form
        scanner: {
          seenMints: Array.from((this.state.scanner?.seenMints || new Map()).entries()),
          completedMints: Array.from(this.state.scanner?.completedMints || []),
        },
        positions: Array.from(this.state.positions?.entries() || []),
        dailyStats: { ...this.state.dailyStats },
        signals: this.state.signals || [],
      },
    };

    const snapshotId = crypto.randomUUID();
    const tempPath = path.join(this.dataDir, 'snapshots', `snapshot_${snapshotId}.tmp`);
    const finalPath = path.join(this.dataDir, 'snapshots', `snapshot_${snapshotId}.json`);

    // Write to temp file
    await fs.writeFile(tempPath, JSON.stringify(snapshot, null, 2));
    
    // Atomic rename
    await fs.rename(tempPath, finalPath);
    
    // Clean up old snapshots (keep last 5)
    await this._cleanupOldSnapshots();

    console.log('[state] snapshot taken:', snapshotId);
    
    // Clear WAL up to this point
    this.wal = [];
    
    return snapshotId;
  }

  async _loadLatestSnapshot() {
    const snapshotsDir = path.join(this.dataDir, 'snapshots');
    
    try {
      const files = await fs.readdir(snapshotsDir);
      
      const snapshots = files
        .filter(f => f.startsWith('snapshot_') && f.endsWith('.json'))
        .map(f => ({
          path: f,
          timestamp: parseInt(f.split('_')[1]?.split('.')[0]) || 0,
        }))
        .sort((a, b) => b.timestamp - a.timestamp);

      if (snapshots.length === 0) return null;

      const latest = snapshots[0];
      const data = await fs.readFile(
        path.join(snapshotsDir, latest.path),
        'utf-8'
      );

      return JSON.parse(data);
    } catch (e) {
      console.error('[state] failed to load snapshot:', e.message);
      return null;
    }
  }

  async _replayWal(walOffset) {
    const walDir = path.join(this.dataDir, 'wal');
    
    try {
      const files = await fs.readdir(walDir);
      
      for (const file of files.sort()) {
        const data = await fs.readFile(path.join(walDir, file), 'utf-8');
        const entries = data.trim().split('\n').filter(Boolean).map(JSON.parse);
        
        for (const entry of entries) {
          this._applyWalEntry(entry);
        }
      }
      
      console.log('[state] WAL replayed:', this.wal.length, 'entries');
    } catch (e) {
      console.error('[state] WAL replay failed:', e.message);
    }
  }

  _applyWalEntry(entry) {
    switch (entry.type) {
      case 'MINT_SEEN':
        this.state.scanner.seenMints.set(entry.mint, entry.data);
        break;
        
      case 'POSITION_OPENED':
        this.state.positions.set(entry.mint, entry.position);
        break;
        
      case 'POSITION_UPDATED':
        const pos = this.state.positions.get(entry.mint);
        if (pos) {
          Object.assign(pos, entry.updates);
        }
        break;
        
      case 'POSITION_CLOSED':
        this.state.positions.delete(entry.mint);
        break;
    }
  }

  _walAppend(entry) {
    if (!config.persistence.useWal) return;

    this.wal.push(entry);
    
    // Flush if buffer gets large
    if (this.wal.length >= 100) {
      this._flushWal();
    }
  }

  async _flushWal() {
    if (this.wal.length === 0) return;

    const walFile = `wal_${Date.now()}.log`;
    const walPath = path.join(this.dataDir, 'wal', walFile);
    
    const data = this.wal.map(e => JSON.stringify(e)).join('\n');
    await fs.writeFile(walPath, data + '\n');
    
    this.wal = [];
  }

  _startSnapshotSchedule() {
    const interval = config.persistence.snapshotIntervalMs || 300000;
    
    this.snapshotTimer = setInterval(async () => {
      try {
        await this.takeSnapshot();
      } catch (e) {
        console.error('[state] snapshot error:', e.message);
      }
    }, interval).unref?.();
  }

  _startWalSchedule() {
    // Flush WAL every 5 seconds
    this.walTimer = setInterval(async () => {
      await this._flushWal();
    }, 5000).unref?.();
  }

  async _cleanupOldSnapshots() {
    const snapshotsDir = path.join(this.dataDir, 'snapshots');
    
    try {
      const files = await fs.readdir(snapshotsDir);
      
      const snapshots = files
        .filter(f => f.startsWith('snapshot_') && f.endsWith('.json'))
        .map(f => ({
          path: f,
          mtime: fs.stat(path.join(snapshotsDir, f)).then(s => s.mtime),
        }));

      // Sort by modification time, keep last 5
      // Simplified - just keep last 5 files
      if (snapshots.length > 5) {
        const toDelete = snapshots.slice(0, snapshots.length - 5);
        for (const s of toDelete) {
          await fs.unlink(path.join(snapshotsDir, s.path));
        }
      }
    } catch (e) {
      console.error('[state] cleanup error:', e.message);
    }
  }

  async _hashState(state) {
    if (!state || !state.positions) {
      return 'initial';
    }
    
    const data = JSON.stringify({
      positions: Array.from(state.positions.entries()),
      dailyStats: state.dailyStats,
    });
    
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('[state] shutting down...');
    
    // Stop timers
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
    if (this.walTimer) clearInterval(this.walTimer);
    
    // Final snapshot
    await this.takeSnapshot();
    
    // Final WAL flush
    await this._flushWal();
    
    console.log('[state] shutdown complete');
  }

  getStats() {
    return {
      hasState: !!this.state,
      openPositions: this.state?.positions?.size || 0,
      dailyStats: this.state?.dailyStats || null,
      walBufferSize: this.wal.length,
    };
  }
}

module.exports = { StateManager };
