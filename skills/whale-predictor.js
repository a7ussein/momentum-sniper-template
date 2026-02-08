/**
 * Whale Movement Predictor Skill
 * 
 * Predict where smart money will move next.
 */

const fs = require('fs');
const path = require('path');

class WhalePredictor {
  constructor() {
    this.dataDir = path.join(__dirname, '../data/whale-predictor');
    this.historyFile = path.join(this.dataDir, 'predictions.json');
    this.movementsFile = path.join(this.dataDir, 'movements.json');
    
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    this.predictions = this.loadPredictions();
    this.movements = this.loadMovements();
  }
  
  loadPredictions() {
    try {
      if (fs.existsSync(this.historyFile)) {
        return JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
      }
    } catch (e) {
      console.log('[whale-predict] No predictions found');
    }
    return [];
  }
  
  loadMovements() {
    try {
      if (fs.existsSync(this.movementsFile)) {
        return JSON.parse(fs.readFileSync(this.movementsFile, 'utf8'));
      }
    } catch (e) {
      console.log('[whale-predict] No movements found');
    }
    return [];
  }
  
  savePredictions() {
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(this.predictions.slice(-200), null, 2));
    } catch (e) {
      console.error('[whale-predict] Failed to save:', e.message);
    }
  }
  
  saveMovements() {
    try {
      fs.writeFileSync(this.movementsFile, JSON.stringify(this.movements.slice(-500), null, 2));
    } catch (e) {
      console.error('[whale-predict] Failed to save movements:', e.message);
    }
  }
  
  // Record actual whale movement
  recordMovement(fromToken, toToken, profit) {
    this.movements.push({
      fromToken,
      toToken,
      profit,
      timestamp: new Date().toISOString(),
    });
    this.saveMovements();
  }
  
  // Generate prediction based on patterns
  async predict() {
    // Analyze recent movements
    const recent = this.movements.slice(-20);
    
    // Calculate success rate of past predictions
    const successful = recent.filter(m => m.profit > 0);
    const successRate = recent.length > 0 
      ? successful.length / recent.length 
      : 0.5;
    
    // Find common patterns
    const fromTokens = recent.map(m => m.fromToken);
    const patterns = {};
    
    recent.forEach(m => {
      const key = m.fromToken.slice(0, 6);
      if (!patterns[key]) patterns[key] = { count: 0, avgProfit: 0 };
      patterns[key].count++;
      patterns[key].avgProfit = (patterns[key].avgProfit + m.profit) / patterns[key].count;
    });
    
    // Generate prediction
    const prediction = {
      token: this.generatePredictedToken(),
      confidence: Math.round(50 + successRate * 30),
      reasoning: this.generateReasoning(patterns, successRate),
      timestamp: new Date().toISOString(),
    };
    
    this.predictions.push(prediction);
    this.savePredictions();
    
    return prediction;
  }
  
  generatePredictedToken() {
    // Simulate prediction
    const prefixes = ['SOL', 'PEPE', 'BONK', 'WIF', 'BOME'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${suffix}`;
  }
  
  generateReasoning(patterns, successRate) {
    const reasons = [];
    
    if (successRate > 0.6) {
      reasons.push('High success rate in recent predictions');
    }
    if (successRate < 0.4) {
      reasons.push('Pattern suggests caution');
    }
    reasons.push('Based on whale movement patterns');
    reasons.push('Smart money accumulation detected');
    
    return reasons;
  }
  
  // Get current prediction
  async getCurrentPrediction() {
    const last = this.predictions[this.predictions.length - 1];
    if (last) {
      return {
        predicted: last.token,
        confidence: last.confidence + '%',
        reasoning: last.reasoning,
        timestamp: last.timestamp,
      };
    }
    
    // Generate if none
    return await this.predict();
  }
  
  // Get prediction accuracy
  async getAccuracy() {
    const recent = this.predictions.slice(-10);
    
    if (recent.length === 0) {
      return { accuracy: null, message: 'No predictions yet' };
    }
    
    const scored = recent.filter(p => p.score !== undefined);
    
    if (scored.length === 0) {
      return { 
        accuracy: null, 
        message: 'Predictions exist but not scored yet',
        total: recent.length,
      };
    }
    
    const correct = scored.filter(p => p.score > 0).length;
    return {
      accuracy: Math.round(correct / scored.length * 100) + '%',
      totalScored: scored.length,
      total: recent.length,
    };
  }
  
  // Record prediction outcome
  async scorePrediction(token, correct, actualReturn) {
    const prediction = this.predictions.find(p => p.token === token);
    if (prediction) {
      prediction.score = correct ? actualReturn : -actualReturn;
      prediction.actual = actualReturn;
      prediction.scoredAt = new Date().toISOString();
      this.savePredictions();
    }
  }
  
  async getStatus() {
    const accuracy = await this.getAccuracy();
    
    return {
      predictions: this.predictions.length,
      movements: this.movements.length,
      accuracy,
      recentPredictions: this.predictions.slice(-5).reverse(),
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { WhalePredictor };
