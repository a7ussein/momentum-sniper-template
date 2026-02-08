const { PublicKey } = require('@solana/web3.js');
const { PUMPFUN_PROGRAM_ID } = require('./constants');

function readU64LE(buf, off) {
  let n = 0n;
  for (let i = 0; i < 8; i++) n |= BigInt(buf[off + i]) << (8n * BigInt(i));
  return n;
}

// BondingCurveAccount fields (after discriminator u64):
// virtual_token_reserves u64
// virtual_sol_reserves   u64
// real_token_reserves    u64
// real_sol_reserves      u64
// ... (some versions may have more, but these are the core fields) :contentReference[oaicite:1]{index=1}
function parseBondingCurve(buf) {
  if (!buf || buf.length < 8 + 8*4) return null;

  const disc = readU64LE(buf, 0);
  const virtualToken = readU64LE(buf, 8);
  const virtualSol   = readU64LE(buf, 16);
  const realToken    = readU64LE(buf, 24);
  const realSol      = readU64LE(buf, 32);

  return {
    discriminator: disc.toString(),
    virtualToken: virtualToken.toString(),
    virtualSol: virtualSol.toString(),
    realToken: realToken.toString(),
    realSol: realSol.toString(),
  };
}

// PDA derivation: ["bonding-curve", mint] :contentReference[oaicite:2]{index=2}
function getBondingCurvePda(mintStr) {
  const programId = new PublicKey(PUMPFUN_PROGRAM_ID);
  const mint = new PublicKey(mintStr);

  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('bonding-curve'), mint.toBuffer()],
    programId
  );
  return pda.toBase58();
}

async function fetchBondingCurve({ rpc, mint }) {
  const curvePda = getBondingCurvePda(mint);

  const acc = await rpc('getAccountInfo', [
    curvePda,
    { commitment: 'confirmed', encoding: 'base64' }
  ]);

  // Handle both Helius and standard Solana RPC response formats
  let b64 = acc?.value?.data?.[0];
  if (!b64 && acc?.value?.data) {
    b64 = typeof acc.value.data === 'string' ? acc.value.data : null;
  }
  if (!b64) return null;

  const buf = Buffer.from(b64, 'base64');
  const parsed = parseBondingCurve(buf);
  if (!parsed) return null;

  return { curvePda, ...parsed };
}

function curveStage(progressPct) {
  if (progressPct >= 100) return 'GRADUATED';
  if (progressPct >= 80) return '80-99';
  if (progressPct >= 50) return '50-80';
  if (progressPct >= 20) return '20-50';
  return '0-20';
}

// Simple progress heuristic:
// - real_token_reserves starts near total supply and decreases as tokens are bought
// - use mint supply as a denominator (works well in practice; adjust later if needed)
function computeProgressPct({ realToken, supply }) {
  const rt = BigInt(realToken);
  const sup = BigInt(supply);
  if (sup === 0n) return 0;

  // sold = supply - realToken
  const sold = sup > rt ? (sup - rt) : 0n;
  const pct = Number((sold * 10000n) / sup) / 100; // 2 decimals
  return Math.max(0, Math.min(100, pct));
}

module.exports = {
  fetchBondingCurve,
  computeProgressPct,
  curveStage,
};
