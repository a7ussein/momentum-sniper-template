# Momentum Sniper - Adaptive Strategy System

## Overview

v2.0 introduces an **Adaptive Strategy System** that learns from every trade and automatically adjusts to market conditions.

## Components

### 1. Market Health Monitor (`src/utils/marketHealth.js`)

Tracks market conditions in real-time:
- Win rate tracking (overall and recent)
- Automatically detects if market is GOOD, NEUTRAL, BAD, or CRITICAL
- Recommends strategy based on conditions

**States:**
- `GOOD` - Win rate > 50%, market favorable → Go aggressive
- `NEUTRAL` - Mixed signals → Balanced approach  
- `BAD` - Win rate < 30% → Conservative mode
- `CRITICAL` - Win rate < 20% → Pause or tiny positions

### 2. Learning Memory (`src/utils/learningMemory.js`)

Persists knowledge across sessions:
- Records lessons learned
- Tracks which strategies work best
- Stores daily performance stats
- Provides advice based on history

**What it remembers:**
- Win/loss patterns
- Successful strategies
- Common issues
- Best performing configurations

### 3. Adaptive Strategy Manager (`src/utils/adaptiveStrategy.js`)

Orchestrates both systems:
- Automatically switches strategies based on market health
- Records results of each strategy
- Learns from experience
- Provides real-time status

## Strategy Configurations

| Strategy | Min Score | Max Positions | Position Size | When Used |
|----------|-----------|---------------|---------------|-----------|
| AGGRESSIVE | 60 | 5 | 0.01 SOL | Good market |
| BALANCED | 70 | 3 | 0.005 SOL | Neutral |
| CONSERVATIVE | 80 | 2 | 0.002 SOL | Bad market |
| PAUSE | 95 | 1 | 0.001 SOL | Critical market |

## Memory Files

Lessons are persisted in `data/memory/`:
- `lessons.json` - Learned lessons and strategy performance
- `daily-log.json` - Daily performance history

## How It Works

1. **Every Trade:** Records win/loss to market health
2. **Every 10 Trades:** Checks if strategy needs adjustment
3. **Every Session:** Saves lessons to memory
4. **Every New Session:** Loads learned lessons and advice

## Example Output

```
[stats] { wsEvents: 1234, queued: 45, signals: 23, positions: 2, dailyPnL: '0.15' }
[strategy] 🧠 { mode: 'BALANCED', winRate: '45%', marketState: 'NEUTRAL' }
```

## Next Steps for Improvement

1. Add token characteristic analysis (哪些类型的代币表现更好)
2. Implement time-of-day optimization
3. Add volatility detection
4. Build confidence scoring for predictions
5. Integrate with external market sentiment data

## Usage

The system runs automatically. To check status:

```javascript
const status = strategyManager.getStatus();
console.log(status);
```

Output includes:
- Current strategy and config
- Market health status
- Today's stats
- Learned advice
- Best performing strategy
