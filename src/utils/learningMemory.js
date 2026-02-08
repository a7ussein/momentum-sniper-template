/**
 * Learning Memory System
 * 
 * Persists lessons learned across sessions.
 */

const fs = require('fs');
const path = require('path');

class LearningMemory {
  constructor() {
    this.dataDir = './data/memory';
    this.memoryFile = path.join(this.dataDir, 'lessons.json');
    this.dailyFile = path.join(this.dataDir, 'daily-log.json');
    
    this.lessons = [];
    this.dailyStats = [];
    this.strategyWins = {}; // Track which strategies work
    this.tokenPatterns = {}; // Remember token characteristics
    
    this._load();
  }
  
  _load() {
    // Create directory if needed
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // Load lessons
    if (fs.existsSync(this.memoryFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.memoryFile));
        this.lessons = data.lessons || [];
        this.strategyWins = data.strategyWins || {};
      } catch (e) {
        console.log('[memory] Could not load lessons');
      }
    }
    
    // Load daily stats
    if (fs.existsSync(this.dailyFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.dailyFile));
        this.dailyStats = data.stats || [];
      } catch (e) {
        console.log('[memory] Could not load daily stats');
      }
    }
  }
  
  save() {
    try {
      fs.writeFileSync(this.memoryFile, JSON.stringify({
        lessons: this.lessons,
        strategyWins: this.strategyWins,
        updated: new Date().toISOString(),
      }, null, 2));
      
      fs.writeFileSync(this.dailyFile, JSON.stringify({
        stats: this.dailyStats.slice(-100), // Keep last 100 days
        updated: new Date().toISOString(),
      }, null, 2));
    } catch (e) {
      console.error('[memory] Save error:', e.message);
    }
  }
  
  addLesson(lesson) {
    const entry = {
      id: Date.now(),
      lesson: lesson,
      timestamp: new Date().toISOString(),
      tags: this._extractTags(lesson),
    };
    
    this.lessons.push(entry);
    this.save();
    
    console.log('[memory] 📚 New lesson:', lesson);
  }
  
  recordDay(stats) {
    this.dailyStats.push({
      date: new Date().toISOString().split('T')[0],
      ...stats,
    });
    this.save();
  }
  
  recordStrategyResult(strategy, won) {
    if (!this.strategyWins[strategy]) {
      this.strategyWins[strategy] = { wins: 0, losses: 0 };
    }
    if (won) {
      this.strategyWins[strategy].wins++;
    } else {
      this.strategyWins[strategy].losses++;
    }
    this.save();
  }
  
  getBestStrategy() {
    let best = null;
    let bestRate = 0;
    
    for (const [strategy, stats] of Object.entries(this.strategyWins)) {
      const total = stats.wins + stats.losses;
      if (total >= 5) {
        const rate = stats.wins / total;
        if (rate > bestRate) {
          bestRate = rate;
          best = strategy;
        }
      }
    }
    
    return best ? { strategy: best, winRate: bestRate } : null;
  }
  
  getRecentLessons(limit = 10) {
    return this.lessons.slice(-limit);
  }
  
  getAdvice() {
    const advice = [];
    
    // Check strategy performance
    const best = this.getBestStrategy();
    if (best && best.winRate > 0.6) {
      advice.push(`Strategy "${best.strategy}" is working (${(best.winRate * 100).toFixed(0)}% win rate)`);
    }
    
    // Check for patterns
    if (this.lessons.length > 0) {
      const recent = this.getRecentLessons(5);
      const tags = recent.flatMap(l => l.tags || []);
      const tagCounts = {};
      tags.forEach(t => tagCounts[t] = (tagCounts[t] || 0) + 1);
      
      const commonIssues = Object.entries(tagCounts)
        .filter(([_, count]) => count > 1)
        .map(([tag]) => tag);
      
      if (commonIssues.length > 0) {
        advice.push(`Recent issues: ${commonIssues.join(', ')}`);
      }
    }
    
    return advice;
  }
  
  _extractTags(lesson) {
    const tags = [];
    const lower = lesson.toLowerCase();
    
    if (lower.includes('win') || lower.includes('profit')) tags.push('WIN');
    if (lower.includes('loss') || lower.includes('stop')) tags.push('LOSS');
    if (lower.includes('market')) tags.push('MARKET');
    if (lower.includes('timing')) tags.push('TIMING');
    if (lower.includes('strategy')) tags.push('STRATEGY');
    if (lower.includes('position')) tags.push('POSITION');
    
    return tags;
  }
}

module.exports = { LearningMemory };
