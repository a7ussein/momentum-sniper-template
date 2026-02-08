const WebSocket = require('ws');
const EventEmitter = require('events');
const { PUMPFUN_PROGRAM_ID } = require('./constants');

class PumpFunScanner extends EventEmitter {
  constructor({ rpcWsUrl }) {
    super();
    this.rpcWsUrl = rpcWsUrl;
    this.ws = null;
    this._seenSigs = new Map(); // signature -> timestamp
  }

  start() {
    console.log('[scanner] connecting to Solana WS...');
    this.ws = new WebSocket(this.rpcWsUrl);

    this.ws.on('open', () => {
      console.log('[scanner] connected');
      this.subscribe();
      // periodic dedupe cleanup
      setInterval(() => this._cleanupSeen(60_000), 10_000).unref?.();
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleMessage(msg);
      } catch (err) {
        console.error('[scanner] parse error', err);
      }
    });

    this.ws.on('close', () => {
      console.warn('[scanner] disconnected');
    });

    this.ws.on('error', (err) => {
      console.error('[scanner] ws error', err);
    });
  }

  subscribe() {
    console.log('[scanner] sending logsSubscribe payload...');
    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'logsSubscribe',
      params: [
        { mentions: [PUMPFUN_PROGRAM_ID] },
        { commitment: 'processed' }
      ]
    };

    this.ws.send(JSON.stringify(payload));
    console.log('[scanner] subscribed to Pump.fun program logs');
  }

  handleMessage(msg) {
    // Confirm subscription
    if (msg.id === 1 && msg.result) {
      console.log('[scanner] subscription id:', msg.result);
      return;
    }

    if (msg.method !== 'logsNotification') return;

    const value = msg.params?.result?.value;
    const logs = value?.logs;
    const signature = value?.signature;

    if (!logs || !signature) return;

    // Dedupe: WS can send multiple notifications per signature
    if (this._seenSigs.has(signature)) return;
    this._seenSigs.set(signature, Date.now());

    // Very lightweight mint-ish pattern (we'll refine later)
    const isLikelyMint = logs.some((l) =>
      l.includes('InitializeMint') ||
      l.toLowerCase().includes('initialize') ||
      l.toLowerCase().includes('create')
    );

    if (!isLikelyMint) return;

    const event = { signature, detectedAt: Date.now() };
    this.emit('mint', event);
    console.log('[scanner] MINT DETECTED:', signature);
  }

  _cleanupSeen(ttlMs) {
    const now = Date.now();
    for (const [sig, ts] of this._seenSigs.entries()) {
      if (now - ts > ttlMs) this._seenSigs.delete(sig);
    }
  }
}

module.exports = PumpFunScanner;
