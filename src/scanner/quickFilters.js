function quickFilterTxMeta({ blockTime, nowMs, maxAgeSec }) {
  if (!blockTime) return { ok: false, reason: 'no_blocktime' };
  const ageSec = Math.max(0, Math.floor(nowMs / 1000) - blockTime);
  if (ageSec > maxAgeSec) return { ok: false, reason: 'too_old' };
  return { ok: true };
}

module.exports = { quickFilterTxMeta };
