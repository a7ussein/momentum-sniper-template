/**
 * Health Check & Monitoring Server
 * 
 * Provides:
 * - Stats endpoint
 * - Health check
 * - Metrics export
 */

const http = require('http');
const config = require('../../config');

class HealthServer {
  constructor({ positionManager, validationQueue, stateManager, port = 3000 }) {
    this.port = port;
    this.positionManager = positionManager;
    this.validationQueue = validationQueue;
    this.stateManager = stateManager;
    this.server = null;
  }

  start() {
    this.server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${this.port}`);
      
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');

      if (url.pathname === '/health' || url.pathname === '/') {
        this._handleHealth(res);
      } else if (url.pathname === '/stats') {
        this._handleStats(res);
      } else if (url.pathname === '/positions') {
        this._handlePositions(res);
      } else if (url.pathname === '/metrics') {
        this._handleMetrics(res);
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });

    this.server.listen(this.port, () => {
      console.log(`[health] Server running on port ${this.port}`);
    });
  }

  _handleHealth(res) {
    const healthy = true;
    
    res.statusCode = healthy ? 200 : 503;
    res.end(JSON.stringify({
      status: healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      mode: config.trading.mode,
      uptime: process.uptime(),
    }));
  }

  _handleStats(res) {
    const validationStats = this.validationQueue?.getStats() || {};
    const positionStats = this.positionManager?.getStats();
    const stateStats = this.stateManager?.getStats();

    res.end(JSON.stringify({
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      mode: config.trading.mode,
      validation: validationStats,
      positions: positionStats,
      state: stateStats,
      memory: process.memoryUsage(),
    }));
  }

  _handlePositions(res) {
    const positions = this.positionManager?.getOpenPositions() || [];
    
    res.end(JSON.stringify({
      count: positions.length,
      positions: positions.map(p => ({
        mint: p.mint,
        state: p.state,
        pnlPct: p.pnlPct?.toFixed(2),
        durationMs: Date.now() - p.entryTime,
      })),
    }));
  }

  _handleMetrics(res) {
    // Prometheus-compatible metrics format
    const positionStats = this.positionManager?.getStats();
    
    let metrics = `# HELP sniper_uptime_seconds Process uptime in seconds
# TYPE sniper_uptime_seconds gauge
sniper_uptime_seconds ${process.uptime()}

# HELP sniper_positions_open Current number of open positions
# TYPE sniper_positions_open gauge
sniper_positions_open ${positionStats?.openPositions || 0}

# HELP sniper_daily_pnl_sol Daily profit/loss in SOL
# TYPE sniper_daily_pnl_sol gauge
sniper_daily_pnl_sol ${positionStats?.dailyStats?.totalPnL || 0}

# HELP sniper_daily_trades Total trades today
# TYPE sniper_daily_trades counter
sniper_daily_trades ${positionStats?.dailyStats?.trades?.length || 0}

# HELP sniper_daily_wins Winning trades today
# TYPE sniper_daily_wins counter
sniper_daily_wins ${positionStats?.dailyStats?.wins || 0}

# HELP sniper_daily_losses Losing trades today
# TYPE sniper_daily_losses counter
sniper_daily_losses ${positionStats?.dailyStats?.losses || 0}
`;

    res.setHeader('Content-Type', 'text/plain');
    res.end(metrics);
  }

  stop() {
    if (this.server) {
      this.server.close();
      console.log('[health] Server stopped');
    }
  }
}

module.exports = { HealthServer };
