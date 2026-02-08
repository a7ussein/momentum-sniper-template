/**
 * ML Predictions Skill
 * 
 * Simple machine learning predictions for token price movements.
 * Uses historical patterns to predict future moves.
 */

const fs = require('fs');
const path = require('path');

class MLPredictor {
  constructor() {
    this.dataDir = path.join(__dirname, '../data/ml');
    this.modelFile = path.join(this.dataDir, 'model.json');
    this.predictionsFile = path.join(this.dataDir, 'predictions.json');
    
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    this.model = this.loadModel();
    this.predictions = this.loadPredictions();
  }
  
  loadModel() {
    try {
      if (fs.existsSync(this.modelFile)) {
        return JSON.parse(fs.readFileSync(this.modelFile, 'utf8'));
      }
    } catch (e) {}
    return {
      version: '1.0',
      trainedAt: null,
      weights: this.initializeWeights(),
      accuracy: { correct: 0, total: 0 },
    };
  }
  
  loadPredictions() {
    try {
      if (fs.existsSync(this.predictionsFile)) {
        return JSON.parse(fs.readFileSync(this.predictionsFile, 'utf8'));
      }
    } catch (e) {}
    return [];
  }
  
  initializeWeights() {
    // Simple feature weights based on trading knowledge
    return {
      momentumScore: 0.25,
      volumeChange: 0.15,
      priceChange1h: 0.20,
      priceChange24h: 0.15,
      liquidity: 0.10,
      holderCount: 0.05,
      socialScore: 0.10,
    };
  }
  
  saveModel() {
    try {
      fs.writeFileSync(this.modelFile, JSON.stringify(this.model, null, 2));
    } catch (e) {}
  }
  
  savePredictions() {
    try {
      fs.writeFileSync(this.predictionsFile, JSON.stringify(this.predictions.slice(-200), null, 2));
    } catch (e) {}
  }
  
  // Extract features from token data
  extractFeatures(tokenData) {
    return {
      momentumScore: tokenData.momentumScore || 50,
      volumeChange: tokenData.volumeChange || 0,
      priceChange1h: tokenData.priceChange1h || 0,
      priceChange24h: tokenData.priceChange24h || 0,
      liquidity: tokenData.liquidity || 1000,
      holderCount: tokenData.holderCount || 10,
      socialScore: tokenData.socialScore || 50,
    };
  }
  
  // Normalize features
  normalize(features) {
    return {
      momentumScore: features.momentumScore / 100,
      volumeChange: Math.min(Math.max(features.volumeChange / 100, -1), 1),
      priceChange1h: Math.min(Math.max(features.priceChange1h / 50, -1), 1),
      priceChange24h: Math.min(Math.max(features.priceChange24h / 100, -1), 1),
      liquidity: Math.min(features.liquidity / 10000, 1),
      holderCount: Math.min(features.holderCount / 100, 1),
      socialScore: features.socialScore / 100,
    };
  }
  
  // Make prediction
  predict(features) {
    const normalized = this.normalize(features);
    const weights = this.model.weights;
    
    // Calculate weighted score
    let score = 0;
    score += normalized.momentumScore * weights.momentumScore;
    score += normalized.volumeChange * weights.volumeChange;
    score += normalized.priceChange1h * weights.priceChange1h;
    score += normalized.priceChange24h * weights.priceChange24h;
    score += normalized.liquidity * weights.liquidity;
    score += normalized.holderCount * weights.holderCount;
    score += normalized.socialScore * weights.socialScore;
    
    // Convert to 0-100 score
    const predictionScore = Math.round(Math.max(0, Math.min(100, score * 100)));
    
    // Determine direction and confidence
    let direction = 'NEUTRAL';
    let confidence = 50;
    
    if (predictionScore >= 60) {
      direction = 'BULLISH';
      confidence = predictionScore;
    } else if (predictionScore >= 55) {
      direction = 'SLIGHTLY_BULLISH';
      confidence = predictionScore;
    } else if (predictionScore <= 40) {
      direction = 'BEARISH';
      confidence = 100 - predictionScore;
    } else if (predictionScore <= 45) {
      direction = 'SLIGHTLY_BEARISH';
      confidence = 100 - predictionScore;
    }
    
    return {
      score: predictionScore,
      direction,
      confidence: Math.round(confidence),
      factors: this.getFactors(normalized),
    };
  }
  
  // Get contributing factors
  getFactors(normalized) {
    const factors = [];
    
    if (normalized.momentumScore > 0.7) factors.push({ factor: 'Strong momentum', impact: 'HIGH' });
    else if (normalized.momentumScore > 0.5) factors.push({ factor: 'Momentum', impact: 'MEDIUM' });
    
    if (normalized.priceChange1h > 0.3) factors.push({ factor: 'Recent pump', impact: 'HIGH' });
    else if (normalized.priceChange1h < -0.3) factors.push({ factor: 'Recent dump', impact: 'HIGH' });
    
    if (normalized.liquidity > 0.5) factors.push({ factor: 'Good liquidity', impact: 'POSITIVE' });
    else if (normalized.liquidity < 0.2) factors.push({ factor: 'Low liquidity', impact: 'NEGATIVE' });
    
    if (normalized.socialScore > 0.6) factors.push({ factor: 'Social buzz', impact: 'POSITIVE' });
    
    return factors;
  }
  
  // Predict token price movement
  async predictToken(tokenData) {
    const features = this.extractFeatures(tokenData);
    const prediction = this.predict(features);
    
    const result = {
      token: tokenData.mint || 'Unknown',
      ...prediction,
      timestamp: new Date().toISOString(),
    };
    
    this.predictions.push(result);
    this.savePredictions();
    
    return result;
  }
  
  // Record prediction outcome
  async recordOutcome(token, predictedDirection, actualDirection) {
    const correct = predictedDirection === actualDirection;
    
    this.model.accuracy.total++;
    if (correct) this.model.accuracy.correct++;
    
    // Simple weight adjustment (very basic learning)
    if (this.model.accuracy.total % 10 === 0) {
      this.adjustWeights(correct);
    }
    
    this.saveModel();
    
    return { correct, accuracy: this.getAccuracy() };
  }
  
  // Adjust weights based on accuracy
  adjustWeights(correct) {
    const adjustment = correct ? 0.02 : -0.02;
    
    // Boost momentum and price factors if winning
    if (correct) {
      this.model.weights.momentumScore += adjustment;
      this.model.weights.priceChange1h += adjustment;
    } else {
      this.model.weights.momentumScore -= adjustment;
      this.model.weights.priceChange1h -= adjustment;
    }
    
    // Normalize weights
    const total = Object.values(this.model.weights).reduce((a, b) => a + b, 0);
    for (const key in this.model.weights) {
      this.model.weights[key] /= total;
    }
  }
  
  // Get accuracy
  getAccuracy() {
    if (this.model.accuracy.total === 0) return 'N/A';
    return ((this.model.accuracy.correct / this.model.accuracy.total) * 100).toFixed(1) + '%';
  }
  
  // Get all predictions
  async getPredictions(limit = 20) {
    return this.predictions.slice(-limit).reverse();
  }
  
  // Get status
  async getStatus() {
    return {
      modelVersion: this.model.version,
      trainedAt: this.model.trainedAt || 'Not trained',
      accuracy: this.getAccuracy(),
      totalPredictions: this.predictions.length,
      recentPredictions: this.predictions.slice(-5).reverse(),
    };
  }
  
  // Train model with data
  async train(trainingData) {
    // Simple training - adjust weights based on historical success
    let correct = 0;
    
    for (const data of trainingData) {
      const features = this.extractFeatures(data);
      const prediction = this.predict(features);
      const wasCorrect = prediction.direction === data.actualDirection;
      
      if (wasCorrect) correct++;
      
      // Adjust weights
      this.adjustWeights(wasCorrect);
    }
    
    this.model.trainedAt = new Date().toISOString();
    this.saveModel();
    
    return {
      success: true,
      accuracy: ((correct / trainingData.length) * 100).toFixed(1) + '%',
      samples: trainingData.length,
    };
  }
}

module.exports = { MLPredictor };
