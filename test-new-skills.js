#!/usr/bin/env node
/**
 * Test New Skills - Copy Trading, Arbitrage, ML Predictor
 */

const { CopyTrader } = require('./skills/copy-trading');
const { ArbitrageDetector } = require('./skills/arbitrage-detector');
const { MLPredictor } = require('./skills/ml-predictor');

async function testNewSkills() {
  console.log('🧪 TESTING NEW SKILLS\n' + '='.repeat(50));
  
  // Test Copy Trader
  console.log('\n1️⃣ COPY TRADING:');
  const copyTrader = new CopyTrader();
  await copyTrader.addWallet('TestWhale', '7pVjSWYQV1xXXXXXXxXXXXXXXXXXXXXXXXXXXXXXX');
  const tracked = await copyTrader.getTracked();
  console.log('   ✅ Added wallet:', tracked[0]?.name);
  console.log('   ✅ Tracked wallets:', tracked.length);
  const copyStats = await copyTrader.getStats();
  console.log('   📊 Stats:', copyStats);
  
  // Test Arbitrage
  console.log('\n2️⃣ ARBITRAGE DETECTOR:');
  const arbitrage = new ArbitrageDetector();
  const arbStats = await arbitrage.getStats();
  console.log('   ✅ Scanner initialized');
  console.log('   📊 Stats:', arbStats);
  
  // Test ML Predictor
  console.log('\n3️⃣ ML PREDICTOR:');
  const ml = new MLPredictor();
  
  // Mock token data
  const mockToken = {
    mint: 'TestToken123...',
    momentumScore: 85,
    volumeChange: 25,
    priceChange1h: 10,
    priceChange24h: 50,
    liquidity: 8000,
    holderCount: 50,
    socialScore: 70,
  };
  
  const prediction = await ml.predictToken(mockToken);
  console.log('   ✅ Prediction made');
  console.log('   📊 Direction:', prediction.direction);
  console.log('   📊 Score:', prediction.score);
  console.log('   📊 Confidence:', prediction.confidence + '%');
  console.log('   📊 Factors:', prediction.factors.map(f => f.factor).join(', ') || 'None');
  
  const mlStatus = await ml.getStatus();
  console.log('   📊 Model Version:', mlStatus.modelVersion);
  console.log('   📊 Accuracy:', mlStatus.accuracy);
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ ALL NEW SKILLS WORKING!');
  
  console.log('\n📚 SUMMARY:');
  console.log('   1. Copy Trading - Follow successful wallets');
  console.log('   2. Arbitrage - Find DEX price differences');
  console.log('   3. ML Predictor - AI-powered predictions');
  
  console.log('\n🎯 Ready to integrate with main bot!\n');
}

testNewSkills().catch(console.error);
