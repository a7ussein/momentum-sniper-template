const { TOKEN_PROGRAM_ID } = require('./constants');

async function extractMintFromTx({ tx, rpc }) {
  const meta = tx?.meta;

  // 1) Best signal: token balance mints
  const mintsFromBalances = new Set();
  for (const b of (meta?.postTokenBalances || [])) if (b?.mint) mintsFromBalances.add(b.mint);
  for (const b of (meta?.preTokenBalances || [])) if (b?.mint) mintsFromBalances.add(b.mint);

  // Pump.fun mints often end with "pump" (string form); keep this as a soft heuristic
  const pumpish = [...mintsFromBalances].find(m => typeof m === 'string' && m.endsWith('pump'));
  if (pumpish) return pumpish;

  // If there’s exactly one mint, return it
  if (mintsFromBalances.size === 1) return [...mintsFromBalances][0];

  // 2) Fallback: scan account keys for SPL Mint accounts (82 bytes) owned by Token Program
  const msg = tx?.transaction?.message;
  const keys = msg?.accountKeys;
  if (!Array.isArray(keys) || keys.length === 0) return null;

  const pubkeys = keys.map(k => (typeof k === 'string' ? k : k.pubkey)).filter(Boolean);

  // To avoid huge RPC calls, cap to 60 but sample across the full list
  const max = 60;
  let candidates = pubkeys;

  if (pubkeys.length > max) {
    // take first 20, middle 20, last 20
    const chunk = 20;
    const midStart = Math.max(0, Math.floor(pubkeys.length / 2) - 10);
    candidates = [
      ...pubkeys.slice(0, chunk),
      ...pubkeys.slice(midStart, midStart + chunk),
      ...pubkeys.slice(pubkeys.length - chunk)
    ];
  }

  const infos = await rpc('getMultipleAccounts', [
    candidates,
    { commitment: 'confirmed', encoding: 'base64' }
  ]);

  if (!infos?.value) return null;

  for (let i = 0; i < infos.value.length; i++) {
    const info = infos.value[i];
    if (!info) continue;
    if (info.owner !== TOKEN_PROGRAM_ID) continue;

    const dataB64 = info.data?.[0];
    if (!dataB64) continue;

    const len = Buffer.from(dataB64, 'base64').length;
    if (len === 82) return candidates[i];
  }

  return null;
}

module.exports = { extractMintFromTx };

