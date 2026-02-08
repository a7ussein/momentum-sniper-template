# Snipper Trading Skills Suite

All skills for advanced trading capabilities.

## Skills Overview

| # | Skill | File | API | Purpose |
|---|-------|------|-----|---------|
| 1 | Sentiment Analyzer | `sentiment-analyzer.js` | DexScreener (free) | Social signals & hype |
| 2 | Contract Auditor | `contract-auditor.js` | Solscan (free) | Safety checks |
| 3 | Chart Patterns | `chart-patterns.js` | DexScreener (free) | Technical analysis |
| 4 | Time Optimizer | `time-optimizer.js` | None | Best trading hours |
| 5 | Auto-Compounder | `auto-compounder.js` | None | Reinvest profits |
| 6 | Multi-Wallet | `multi-wallet.js` | None | Risk spreading |
| 7 | Drawdown Protector | `drawdown-protector.js` | None | Hard stops |
| 8 | Whale Predictor | `whale-predictor.js` | None | Smart money tracking |
| 9 | Market Regime | `market-regime.js` | None | Bull/Bear detection |

---

## Free APIs (No Keys Needed!)

### DexScreener API
```
GET https://api.dexscreener.com/latest/dex/tokens/{mint}
```
- Token prices, volume, liquidity
- Social links (Twitter, Telegram)
- Price change history

### Solscan API
```
GET https://api.solscan.io/token/meta?tokenAddress={mint}
```
- Token metadata
- Mint/freeze authority
- Holder count

**Total Cost: $0/month** 🎉

---

## Quick Usage

```javascript
const { SentimentAnalyzer } = require('./skills/sentiment-analyzer');
const { ContractAuditor } = require('./skills/contract-auditor');
const { ChartPatternRecognizer } = require('./skills/chart-patterns');
const { TimeOptimizer } = require('./skills/time-optimizer');
const { AutoCompounder } = require('./skills/auto-compounder');
const { MultiWalletManager } = require('./skills/multi-wallet');
const { DrawdownProtector } = require('./skills/drawdown-protector');
const { WhalePredictor } = require('./skills/whale-predictor');
const { MarketRegimeDetector } = require('./skills/market-regime');

// Initialize
const sentiment = new SentimentAnalyzer();
const auditor = new ContractAuditor();
const charts = new ChartPatternRecognizer();
const time = new TimeOptimizer();
const compounder = new AutoCompounder();
const wallets = new MultiWalletManager();
const protector = new DrawdownProtector();
const whales = new WhalePredictor();
const regime = new MarketRegimeDetector();

// Use skills
const audit = await auditor.auditContract(mint);
const shouldTrade = await auditor.shouldTrade(mint);
const pattern = await charts.analyze(mint);
const timeRec = await time.getRecommendation();
const regimeRec = await regime.analyze();
```

---

## Skill Details

### 1. Sentiment Analyzer
Monitor social media sentiment and hype.

```javascript
await sentiment.analyze(mint);  // Get sentiment score
await sentiment.addToWatchlist(mint, 'Label');
await sentiment.getOverallSentiment();
```

### 2. Contract Auditor  
Detect rug pull patterns before trading.

```javascript
const audit = await auditor.auditContract(mint);
const shouldTrade = await auditor.shouldTrade(mint);
```

### 3. Chart Patterns
Technical analysis for better entries.

```javascript
const pattern = await charts.analyze(mint);
// Returns: pattern, confidence, interpretation, recommendation
```

### 4. Time Optimizer
Find the best hours to trade.

```javascript
const recommendation = await time.getRecommendation();
```

### 5. Auto-Compounder
Automatically reinvest profits.

```javascript
await compounder.enable();
await compounder.onPositionClose(mint, profitPct, solProfit);
```

### 6. Multi-Wallet Manager
Spread risk across wallets.

```javascript
await wallets.addWallet('Aggressive', address, 'AGGRESSIVE', 30);
```

### 7. Drawdown Protector
Hard stops to save capital.

```javascript
await protector.checkDrawdown(currentBalance, dailyLoss);
```

### 8. Whale Predictor
Predict where smart money will move.

```javascript
const prediction = await whales.predict();
```

### 9. Market Regime Detector
Adapt to market conditions.

```javascript
const regime = await regime.analyze();
// Returns: BULL, BEAR, SIDEWAYS, or CHAOTIC
```

---

## Data Storage

```
data/
├── sentiment/
├── audits/
├── charts/
├── time/
├── compounder/
├── wallets/
├── protector/
├── whale-predictor/
└── regime/
```

---

## Test Skills

```bash
node test-skills.js
```

---

## Future Enhancements

- [ ] ML-based predictions
- [ ] Twitter/X API for sentiment
- [ ] Birdeye API for better data
- [ ] Cross-exchange arbitrage
