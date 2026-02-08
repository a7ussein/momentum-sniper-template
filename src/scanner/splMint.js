function readU64LE(buf, off) {
  let n = 0n;
  for (let i = 0; i < 8; i++) n |= BigInt(buf[off + i]) << (8n * BigInt(i));
  return n;
}

function parseSplMint(buf) {
  if (!buf || buf.length !== 82) return null;

  const supply = readU64LE(buf, 36);
  const decimals = buf[44];
  const isInitialized = buf[45] === 1;

  return { supply: supply.toString(), decimals, isInitialized };
}

module.exports = { parseSplMint };
