/**
 * Sentiment Analyzer Skill - Real API Version
 * 
 * Uses DexScreener data for token social signals.
 */

const fs = require('fs');
const path = require('path');

class SentimentAnalyzer {
  constructor() {
    this.dataDir = path.join(__dirname, '../data/sentiment');
    this.historyFile = path.join(this.dataDir, 'history.json');
    this.watchlistFile = path.join(this.dataDir, 'watchlist.json');
    
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    this.history = this.loadHistory();
    this.watchlist = this.loadWatchlist();
  }
  
  loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        return JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
      }
    } catch (e) {
      console.log('[sentiment] No history found');
    }
    return [];
  }
  
  loadWatchlist() {
    try {
      if (fs.existsSync(this.watchlistFile)) {
        return JSON.parse(fs.readFileSync(this.watchlistFile, 'utf8'));
      }
    } catch (e) {
      console.log('[sentiment] No watchlist found');
    }
    return {};
  }
  
  saveHistory() {
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(this.history.slice(-1000), null, 2));
    } catch (e) {
      console.error('[sentiment] Failed to save history:', e.message);
    }
  }
  
  saveWatchlist() {
    try {
      fs.writeFileSync(this.watchlistFile, JSON.stringify(this.watchlist, null, 2));
    } catch (e) {
      console.error('[sentiment] Failed to save watchlist:', e.message);
    }
  }
  
  // Analyze token from DexScreener response
  analyzeDexScreenerData(dexData) {
    const pair = dexData?.pair;
    if (!pair) return null;
    
    const signals = [];
    let sentiment = 50; // Neutral baseline
    
    // Check for social links (indicates real project)
    const hasTwitter = pair.links?.some(l => l.type === 'twitter');
    const hasTelegram = pair.links?.some(l => l.type === 'telegram');
    const hasWebsite = pair.links?.some(l => l.type === 'website');
    
    if (hasTwitter) {
      sentiment += 10;
      signals.push({ type: 'TWITTER', impact: '+10', message: 'Has Twitter/X presence' });
    }
    
    if (hasTelegram) {
      sentiment += 5;
      signals.push({ type: 'TELEGRAM', impact: '+5', message: 'Has Telegram community' });
    }
    
    if (hasWebsite) {
      sentiment += 5;
      signals.push({ type: 'WEBSITE', impact: '+5', message: 'Has official website' });
    }
    
    // Check description
    const description = pair.description || '';
    const hasDescription = description.length > 10;
    
    if (hasDescription) {
      sentiment += 5;
      signals.push({ type: 'DESCRIPTION', impact: '+5', message: 'Has project description' });
    }
    
    // Price performance signals
    const priceChange = parseFloat(pair.priceChange?.h24) || 0;
    
    if (priceChange > 50) {
      sentiment += 10;
      signals.push({ type: 'HOT', impact: '+10', message: 'Strong 24h performance (+' + priceChange.toFixed(1) + '%)' });
    } else if (priceChange > 20) {
      sentiment += 5;
      signals.push({ type: 'BULLISH', impact: '+5', message: 'Positive momentum (+' + priceChange.toFixed(1) + '%)' });
    } else if (priceChange < -30) {
      sentiment -= 15;
      signals.push({ type: 'DUMPING', impact: '-15', message: 'Heavy selling pressure (' + priceChange.toFixed(1) + '%)' });
    } else if (priceChange < -10) {
      sentiment -= 5;
      signals.push({ type: 'WEAKNESS', impact: '-5', message: 'Negative trend (' + priceChange.toFixed(1) + '%)' });
    }
    
    // Liquidity check
    const liquidity = parseFloat(pair.liquidity?.usd) || 0;
    if (liquidity < 1000) {
      sentiment -= 20;
      signals.push({ type: 'LOW_LIQUIDITY', impact: '-20', message: 'Low liquidity - risky' });
    } else if (liquidity > 10000) {
      sentiment += 10;
      signals.push({ type: 'GOOD_LIQUIDITY', impact: '+10', message: 'Strong liquidity support' });
    }
    
    return {
      mint: pair.tokenAddress,
      sentiment: Math.max(0, Math.min(100, sentiment)),
      signals,
      metadata: {
        symbol: pair.baseToken?.symbol || 'Unknown',
        name: pair.baseToken?.name || 'Unknown',
        dex: pair.dexId || 'Unknown',
        marketCap: pair.fdv || 'N/A',
      },
      timestamp: new Date().toISOString(),
    };
  }
  
  // Main analysis function
  async analyze(mint, dexData = null) {
    let result;
    
    if (dexData) {
      result = this.analyzeDexScreenerData(dexData);
    }
    
    if (!result) {
      // Fallback to heuristic
      result = this.heuristicAnalysis(mint);
    }
    
    this.history.push(result);
    this.saveHistory();
    
    return result;
  }
  
  heuristicAnalysis(mint) {
    const signals = [];
    let sentiment = 50;
    
    // Mock signals based on token name patterns
    const name = mint.toLowerCase();
    
    if (name.includes('pepe') || name.includes('frog')) {
      sentiment += 15;
      signals.push({ type: 'MEME', impact: '+15', message: 'Known meme pattern' });
    }
    
    if (name.includes('safe') || name.includes('lock')) {
      sentiment += 5;
      signals.push({ type: 'SAFETY', impact: '+5', message: 'Safety claims in name' });
    }
    
    return {
      mint,
      sentiment: Math.max(0, Math.min(100, sentiment)),
      signals,
      timestamp: new Date().toISOString(),
    };
  }
  
  async addToWatchlist(mint, label, dexData = null) {
    const analysis = await this.analyze(mint, dexData);
    
    this.watchlist[mint] = {
      label,
      added: new Date().toISOString(),
      sentiment: analysis.sentiment,
      alertsEnabled: true,
    };
    this.saveWatchlist();
    
    return { success: true, mint, label, sentiment: analysis.sentiment };
  }
  
  async getWatchlistSentiment() {
    const results = [];
    
    for (const [mint, data] of Object.entries(this.watchlist)) {
      results.push({
        mint: mint.slice(0, 8) + '...',
        label: data.label,
        sentiment: data.sentiment || 50,
      });
    }
    
    return results.sort((a, b) => b.sentiment - a.sentiment);
  }
  
  async getOverallSentiment() {
    if (this.history.length < 5) {
      return { trend: 'INSUFFICIENT_DATA', score: null };
    }
    
    const recent = this.history.slice(-50);
    const avgSentiment = recent.reduce((sum, r) => sum + r.sentiment, 0) / recent.length;
    
    const last10 = this.history.slice(-10);
    const recentAvg = last10.reduce((sum, r) => sum + r.sentiment, 0) / last10.length;
    
    let trend = 'NEUTRAL';
    if (recentAvg > avgSentiment + 5) trend = 'BULLISH';
    if (recentAvg < avgSentiment - 5) trend = 'BEARISH';
    
    return {
      trend,
      score: Math.round(avgSentiment),
      recent: Math.round(recentAvg),
      totalAnalyzed: this.history.length,
    };
  }
  
  async getStatus() {
    const overall = await this.getOverallSentiment();
    const watchlist = await this.getWatchlistSentiment();
    
    return {
      overall,
      watchlistCount: watchlist.length,
      topWatched: watchlist.slice(0, 5),
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { SentimentAnalyzer };
