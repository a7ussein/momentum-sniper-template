const { PublicKey } = require('@solana/web3.js');

const PUMP_PROGRAM_ID = new PublicKey(
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'
);

// PDA seed: ["bonding-curve", mint]
function curvePda(mint) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('bonding-curve'), new PublicKey(mint).toBuffer()],
    PUMP_PROGRAM_ID
  )[0];
}

async function getCurveProgress({ mint, rpc }) {
  const pda = curvePda(mint);
  const acc = await rpc('getAccountInfo', [
    pda.toBase58(),
    { commitment: 'confirmed', encoding: 'base64' }
  ]);

  if (!acc?.value?.data) return null;

  // Handle both Helius and standard Solana RPC response formats
  let b64 = acc.value.data[0];
  if (!b64 && acc.value.data) {
    b64 = typeof acc.value.data === 'string' ? acc.value.data : null;
  }
  if (!b64) return null;

  const buf = Buffer.from(b64, 'base64');

  // Pump.fun layout (simplified)
  const sold = buf.readBigUInt64LE(8);
  const total = buf.readBigUInt64LE(16);

  const progress = Number(sold) / Number(total);

  return {
    progress,
    stage:
      progress < 0.2 ? 'EARLY' :
      progress < 0.5 ? 'MID' :
      progress < 0.8 ? 'LATE' :
      progress < 1.0 ? 'NEAR_END' :
      'COMPLETE'
  };
}

module.exports = { getCurveProgress };
