#!/usr/bin/env node
/**
 * Strategy Status Checker
 * 
 * Run this to see current strategy status and learned lessons.
 */

const { AdaptiveStrategyManager } = require('./src/utils/adaptiveStrategy');

async function main() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║     MOMENTUM SNIPER - Strategy Status            ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  const manager = new AdaptiveStrategyManager();
  const status = manager.getStatus();

  console.log('📊 Current Strategy:');
  console.log(`   Mode: ${status.currentStrategy}`);
  console.log(`   Min Score: ${status.config.minScore}`);
  console.log(`   Max Positions: ${status.config.maxPositions}`);
  console.log(`   Position Size: ${status.config.positionSize} SOL`);
  console.log(`   Stop Loss: ${status.config.stopLoss}%`);
  console.log(`   Take Profits: ${status.config.takeProfit1}% / ${status.config.takeProfit2}%`);

  console.log('\n🌡️ Market Health:');
  console.log(`   State: ${status.marketHealth.state}`);
  console.log(`   Win Rate: ${(status.marketHealth.winRate * 100).toFixed(1)}%`);
  console.log(`   Recent Win Rate: ${(status.marketHealth.recentWinRate * 100).toFixed(1)}%`);
  console.log(`   Total Trades: ${status.marketHealth.totalTrades}`);

  console.log('\n📈 Today\'s Stats:');
  console.log(`   Trades: ${status.todayStats.trades}`);
  console.log(`   Wins: ${status.todayStats.wins}`);
  console.log(`   Losses: ${status.todayStats.losses}`);
  console.log(`   Win Rate: ${status.todayStats.winRate}`);

  console.log('\n🏆 Best Performing Strategy:');
  if (status.bestStrategy) {
    console.log(`   Strategy: ${status.bestStrategy.strategy}`);
    console.log(`   Win Rate: ${(status.bestStrategy.winRate * 100).toFixed(1)}%`);
  } else {
    console.log('   Not enough data yet');
  }

  console.log('\n💡 Advice:');
  if (status.advice.length > 0) {
    status.advice.forEach(a => console.log(`   • ${a}`));
  } else {
    console.log('   No advice yet - need more trading data');
  }

  console.log('\n📚 Recent Lessons:');
  const { LearningMemory } = require('./src/utils/learningMemory');
  const memory = new LearningMemory();
  const lessons = memory.getRecentLessons(5);
  if (lessons.length > 0) {
    lessons.forEach(l => console.log(`   • ${l.lesson}`));
  } else {
    console.log('   No lessons recorded yet');
  }

  console.log('\n');
}

main().catch(console.error);
