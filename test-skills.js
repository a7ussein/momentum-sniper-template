#!/usr/bin/env node

/**
 * Test Skills with Real API Data
 */

const { SentimentAnalyzer } = require('./skills/sentiment-analyzer');
const { ContractAuditor } = require('./skills/contract-auditor');
const { ChartPatternRecognizer } = require('./skills/chart-patterns');

async function testSkills() {
  console.log('🎯 Testing Skills with Real API Data\n');
  console.log('='.repeat(50));
  
  // Test token from DexScreener data
  const testToken = '3UDH4Hg8bfZWRkm969B2Bihw1YSBGvfmo8VBFMjypump';
  
  console.log(`\n📊 Testing with: ${testToken.slice(0, 8)}...`);
  console.log('-'.repeat(50));
  
  // Test Chart Patterns
  console.log('\n1️⃣ Chart Patterns:');
  const charts = new ChartPatternRecognizer();
  const chartResult = await charts.analyze(testToken);
  console.log(`   Pattern: ${chartResult.pattern}`);
  console.log(`   Confidence: ${chartResult.confidence}%`);
  console.log(`   Price: ${chartResult.data.price}`);
  console.log(`   24h Change: ${chartResult.data.change24h}`);
  console.log(`   Volume: ${chartResult.data.volume}`);
  console.log(`   Liquidity: ${chartResult.data.liquidity}`);
  console.log(`   Recommendation: ${chartResult.recommendation.action}`);
  
  // Test Sentiment Analyzer
  console.log('\n2️⃣ Sentiment Analyzer:');
  const sentiment = new SentimentAnalyzer();
  const sentimentResult = await sentiment.analyze(testToken);
  console.log(`   Sentiment Score: ${sentimentResult.sentiment}/100`);
  console.log(`   Signals:`);
  sentimentResult.signals.forEach(s => {
    console.log(`     • ${s.type}: ${s.message} (${s.impact})`);
  });
  
  // Test Contract Auditor
  console.log('\n3️⃣ Contract Auditor:');
  const auditor = new ContractAuditor();
  const auditResult = await auditor.auditContract(testToken);
  console.log(`   Risk Level: ${auditResult.riskLevel}`);
  console.log(`   Risk Score: ${auditResult.riskScore}`);
  console.log(`   Checks:`);
  auditResult.checks.forEach(c => {
    console.log(`     • ${c.type}: ${c.message} [${c.severity}]`);
  });
  
  // Overall assessment
  console.log('\n' + '='.repeat(50));
  console.log('📋 OVERALL ASSESSMENT:');
  console.log('-'.repeat(50));
  
  const isSafe = auditResult.riskLevel === 'LOW';
  const isBullish = chartResult.pattern.includes('UP') || chartResult.pattern === 'PARABOLIC_MOVE';
  const isPositive = sentimentResult.sentiment > 50;
  
  console.log(`   Safety: ${isSafe ? '✅' : '⚠️'} ${auditResult.riskLevel}`);
  console.log(`   Chart: ${isBullish ? '🐂' : '🐻'} ${chartResult.pattern}`);
  console.log(`   Sentiment: ${isPositive ? '😊' : '😟'} ${sentimentResult.sentiment}/100`);
  
  if (isSafe && isBullish && isPositive) {
    console.log('\n   🎯 ALL SYSTEMS GO - Good opportunity!');
  } else if (!isSafe) {
    console.log('\n   🛑 SAFETY CONCERNS - Skip or be very careful');
  } else if (!isBullish) {
    console.log('\n   ⏸️ WAITING - Chart not favorable');
  } else {
    console.log('\n   ⚖️ CAUTION - Mixed signals');
  }
  
  console.log('\n✅ Skills test complete!\n');
}

testSkills().catch(console.error);
