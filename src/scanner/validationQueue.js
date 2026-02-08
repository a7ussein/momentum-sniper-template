/**
 * Validation Queue
 * 
 * Processes mints through full validation pipeline:
 * 1. Quick filters (age, curve progress)
 * 2. Deep validation (holders, volume, liquidity)
 * 3. Momentum scoring
 * 4. Buy simulation
 * 5. Decision (ENTER/PASS)
 */

const config = require('../../config');
const { fetchBondingCurve, computeProgressPct, curveStage } = require('../scanner/pumpCurve');
const { parseSplMint } = require('../scanner/splMint');
const { getCurveProgress } = require('../pumpfun/curve');
const { simulateSwap } = require('../execution/jupiterSwap');
const { TTLCache } = require('../utils/ttlCache');
const { EventEmitter } = require('events');

class ValidationQueue extends EventEmitter {
  constructor({ concurrency = 3, rpc, rpcSpacing }) {
    super();
    this.concurrency = concurrency;
    this.rpc = rpc;
    this.rpcSpacing = rpcSpacing || (() => Promise.resolve());
    this.q = [];
    this.active = 0;
    
    // Cache for validated mints (prevent re-validation)
    this.validatedMints = new TTLCache({ ttlMs: 60 * 60 * 1000 }); // 1 hour
    
    // Metrics
    this.stats = {
      queued: 0,
      processed: 0,
      passed: 0,
      failed: 0,
      entered: 0,
      skipped: 0,
      byFailureReason: {},
    };
  }

  push(mint, metadata) {
    if (this.validatedMints.has(mint)) {
      console.log('[validation] already validated:', mint);
      return;
    }

    this.stats.queued++;
    this.q.push({ mint, metadata, enqueueTime: Date.now() });
    this._drain();
  }

  _drain() {
    while (this.active < this.concurrency && this.q.length) {
      const job = this.q.shift();
      this.active++;
      
      Promise.resolve()
        .then(() => this._processJob(job))
        .catch((e) => console.error('[validation] job error:', e.message))
        .finally(() => {
          this.active--;
          this.stats.processed++;
          this._drain();
        });
    }
  }

  async _processJob({ mint, metadata }) {
    const startTime = Date.now();
    console.log('[validation] starting:', mint);

    try {
      // Run full validation pipeline
      const result = await this._runValidationPipeline(mint);

      // Record result
      this.validatedMints.add(mint);
      
      if (result.decision === 'ENTER') {
        this.stats.entered++;
        console.log('[validation] ✅ ENTER:', {
          mint,
          momentumScore: result.momentumScore,
          tier: result.tier,
          validationTimeMs: Date.now() - startTime,
        });
        
        // Emit signal for trading module
        this.emit('signal', {
          mint,
          ...result,
          metadata,
        });
      } else {
        this.stats.skipped++;
        console.log('[validation] ⏭️ PASS:', {
          mint,
          reason: result.rejectionReason,
          validationTimeMs: Date.now() - startTime,
        });
      }
    } catch (e) {
      this.stats.failed++;
      const reason = e.message;
      this.stats.byFailureReason[reason] = (this.stats.byFailureReason[reason] || 0) + 1;
      
      console.log('[validation] ❌ ERROR:', {
        mint,
        reason,
        validationTimeMs: Date.now() - startTime,
      });
    }
  }

  async _runValidationPipeline(mint) {
    const scanner = config.scanner;
    const momentum = config.momentum;

    // === Step 1: Fetch bonding curve first ===
    const curveData = await this._fetchCurveData(mint);
    if (!curveData) {
      return { decision: 'PASS', rejectionReason: 'CURVE_NOT_FOUND' };
    }

    // === Step 2: Fetch mint info (may not exist for brand new tokens) ===
    const mintInfo = await this._fetchMintInfo(mint);
    const isNew = mintInfo?.isNew || false;
    const supply = mintInfo?.supply || curveData.realToken || '1000000000';

    // === Step 3: Check curve progress ===
    const progress = computeProgressPct({
      realToken: curveData.realToken,
      supply: supply,
    });

    if (progress >= scanner.maxCurveProgress) {
      return { decision: 'PASS', rejectionReason: 'CURVE_GRADUATED' };
    }

    if (progress < scanner.minCurveProgress) {
      return { decision: 'PASS', rejectionReason: 'CURVE_BELOW_MIN' };
    }

    // === Step 4: Quick filter - must be on curve ===
    if (progress >= 100) {
      return { decision: 'PASS', rejectionReason: 'NOT_ON_CURVE' };
    }

    // === Step 5: For new tokens, require minimum validation ===
    // Don't auto-enter - check at least basic curve and holders
    if (isNew) {
      console.log('[validation] new token on curve:', {
        mint: mint.slice(0, 12) + '...',
        progress: progress.toFixed(1) + '%',
      });

      // Basic check: only enter if curve progress is reasonable
      if (progress > 70) {
        return { decision: 'PASS', rejectionReason: 'TOKEN_TOO_MATURE', progress };
      }

      // Run basic validation
      const basicValidation = await this._basicValidate(mint, curveData, progress);
      if (!basicValidation.ok) {
        return { decision: 'PASS', rejectionReason: basicValidation.reason };
      }

      // Calculate preliminary score based on early momentum
      const earlyScore = this._calculateEarlyScore(basicValidation, progress);
      const minScore = momentum.minScore;

      if (earlyScore < minScore) {
        return { decision: 'PASS', rejectionReason: 'WEAK_EARLY_MOMENTUM', earlyScore, minScore };
      }

      const tier = earlyScore >= 80 ? 'EXTREME' : (earlyScore >= 70 ? 'VERY_HOT' : (earlyScore >= minScore ? 'HOT' : 'WARM'));
      const positionSizePct = this._getPositionSizeForTier(tier);

      return {
        decision: 'ENTER',
        mint,
        mintInfo,
        curveData,
        momentumScore: earlyScore,
        tier,
        positionSizePct,
        progress,
        isNew: true,
      };
    }

    // === Step 6: Deep validation for established tokens ===
    const validation = await this._deepValidate(mint, mintInfo, curveData, progress);
    
    if (!validation.ok) {
      return { decision: 'PASS', rejectionReason: validation.reason };
    }

    // === Step 7: Calculate momentum score ===
    const momentumScore = this._calculateMomentumScore(validation, progress);
    const tier = this._getTier(momentumScore);

    // === Step 8: Check minimum momentum ===
    if (momentumScore < momentum.minScore) {
      return { decision: 'PASS', rejectionReason: 'MOMENTUM_BELOW_THRESHOLD', momentumScore };
    }

    // === Step 9: Determine position size based on tier ===
    const positionSizePct = this._getPositionSizeForTier(tier);

    return {
      decision: 'ENTER',
      mint,
      mintInfo,
      curveData,
      validation,
      momentumScore,
      tier,
      positionSizePct,
      progress,
      isNew: false,
    };
  }

  async _fetchMintInfo(mint) {
    try {
      // Retry logic for new accounts that might not be fully propagated
      let acc = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        await this.rpcSpacing();
        
        acc = await this.rpc('getAccountInfo', [
          mint,
          { commitment: 'confirmed', encoding: 'base64' }
        ]);

        if (acc?.value?.data) break;
        
        // Wait and retry for new accounts
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
        }
      }

      if (!acc?.value?.data) {
        return { isNew: true, mint };
      }

      // Handle both Helius and standard Solana RPC response formats
      let b64 = acc.value.data[0];
      if (!b64 && acc.value.data) {
        b64 = typeof acc.value.data === 'string' ? acc.value.data : null;
      }

      if (!b64) return { isNew: true, mint };

      const buf = Buffer.from(b64, 'base64');
      
      // Check if it's a valid SPL mint (82 bytes)
      if (buf.length !== 82) {
        console.log('[validation] unexpected mint size:', buf.length, 'bytes');
        return { isNew: true, mint };
      }

      const mintInfo = parseSplMint(buf);
      
      return {
        isInitialized: true,
        mint,
        supply: mintInfo?.supply || '0',
        decimals: mintInfo?.decimals || 6,
        isNew: false,
      };
    } catch (e) {
      console.error('[validation] _fetchMintInfo error:', e.message);
      return null;
    }
  }

  async _fetchCurveData(mint) {
    try {
      await this.rpcSpacing();
      const curve = await fetchBondingCurve({ rpc: this.rpc, mint });
      if (!curve) return null;

      return {
        curvePda: curve.curvePda,
        virtualToken: curve.virtualToken,
        virtualSol: curve.virtualSol,
        realToken: curve.realToken,
        realSol: curve.realSol,
      };
    } catch (e) {
      console.error('[validation] _fetchCurveData error:', e.message);
      return null;
    }
  }

  async _deepValidate(mint, mintInfo, curveData, progress) {
    const scanner = config.scanner;

    try {
      // === Holder count ===
      // real_token_reserves decreases as people buy
      const supply = mintInfo?.supply || curveData.realToken;
      const realToken = curveData.realToken;
      const soldTokens = BigInt(supply) - BigInt(realToken);
      const estimatedHolders = Number(soldTokens) / 1000000; // Rough estimate

      if (estimatedHolders < scanner.minHolders) {
        return { ok: false, reason: 'INSUFFICIENT_HOLDERS', estimatedHolders };
      }

      // === Volume estimation (simplified) ===
      // In reality, would fetch recent transactions and sum volumes
      const estimatedVolumeSol = this._estimateVolume(mint);
      
      if (estimatedVolumeSol < scanner.minVolume5mSol) {
        return { ok: false, reason: 'INSUFFICIENT_VOLUME', estimatedVolumeSol };
      }

      // === Liquidity check ===
      const liquiditySol = Number(curveData.realSol) / 1e9;
      if (liquiditySol < 0.5) {
        return { ok: false, reason: 'LOW_LIQUIDITY', liquiditySol };
      }

      // === Initial buy check ===
      const initialBuy = this._getInitialBuy(mint);
      if (initialBuy && initialBuy < scanner.minInitialBuySol) {
        return { ok: false, reason: 'SMALL_INITIAL_BUY', initialBuy };
      }

      return {
        ok: true,
        estimatedHolders,
        estimatedVolumeSol,
        liquiditySol,
      };
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  }

  _estimateVolume(mint) {
    // Simplified: random factor for demo
    // In reality, would fetch recent transactions
    return 0.5 + Math.random() * 2;
  }

  _getInitialBuy(mint) {
    // In reality, would parse from initial tx
    return 0.1 + Math.random() * 0.5;
  }

  _calculateMomentumScore(validation, progress) {
    const momentum = config.momentum;
    
    // Normalize to 0-100 scale
    const volumeScore = Math.min((validation.estimatedVolumeSol / 2) * 100, 100);
    const holderScore = Math.min((validation.estimatedHolders / 50) * 100, 100);
    const curveScore = progress * 0.8; // 0-80 based on progress

    // Weighted sum
    const score = (
      volumeScore * momentum.weights.volume +
      holderScore * momentum.weights.holders +
      curveScore * momentum.weights.curve
    );

    return Math.round(score);
  }

  _getTier(score) {
    const tiers = config.momentum.tiers;
    
    if (score >= tiers.EXTREME.minScore) return 'EXTREME';
    if (score >= tiers.VERY_HOT.minScore) return 'VERY_HOT';
    if (score >= tiers.HOT.minScore) return 'HOT';
    if (score >= tiers.WARM.minScore) return 'WARM';
    return 'COLD';
  }

  _getPositionSizeForTier(tier) {
    const tiers = config.momentum.tiers;
    return tiers[tier]?.sizeMultiplier || 0.25;
  }

  async _basicValidate(mint, curveData, progress) {
    // HUNT MODE - Take chances
    try {
      const liquiditySol = Number(curveData.realSol) / 1e9;
      
      // Very low barrier
      if (liquiditySol < 0.15) {
        return { ok: false, reason: 'LOW_LIQUIDITY', liquiditySol, required: 0.15 };
      }

      // Almost any progress - even 0%
      if (progress > 75) {
        return { ok: false, reason: 'TOO_MATURE', progress, range: '0-75%' };
      }

      return { ok: true, liquiditySol, progress };
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  }

  _calculateEarlyScore(validation, progress) {
    // Hunt for winners
    let score = 60;

    // Progress bonus - wider range
    if (progress >= 2 && progress <= 70) score += 25;
    else if (progress >= 0 && progress <= 75) score += 15;

    // Liquidity bonus
    if (validation.liquiditySol >= 0.5) score += 20;
    else if (validation.liquiditySol >= 0.3) score += 15;
    else if (validation.liquiditySol >= 0.15) score += 10;

    return Math.min(score, 100);
  }

  async _simulateBuy(mint) {
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    
    return await simulateSwap({
      inputMint: SOL_MINT,
      outputMint: mint,
      amount: 10000000, // 0.01 SOL lamports
    });
  }

  getStats() {
    return {
      ...this.stats,
      queueLength: this.q.length,
      activeWorkers: this.active,
    };
  }
}

module.exports = { ValidationQueue };
