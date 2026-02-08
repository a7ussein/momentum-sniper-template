const axios = require('axios');
const Bottleneck = require('bottleneck');
const pRetry = require('p-retry');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeRpcClient({ endpoint, headers, rps = 8, concurrency = 2 }) {
  const limiter = new Bottleneck({
    minTime: Math.ceil(1000 / rps),
    maxConcurrent: concurrency,
  });

  async function post(body) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", ...(headers ?? {}) },
      body: JSON.stringify(body),
    });

    if (res.status === 429 || res.status === 503) {
      const txt = await res.text().catch(() => "");
      const err = new Error(`RPC throttled ${res.status}: ${txt.slice(0, 120)}`);
      err.retryable = true;
      throw err;
    }

    const json = await res.json();
    if (json?.error) {
      const err = new Error(`RPC error: ${json.error.message || "unknown"}`);
      err.retryable = true;
      err.rpcError = json.error;
      throw err;
    }
    return json.result;
  }

  async function call(method, params) {
    return limiter.schedule(() =>
      pRetry(
        () => post({ jsonrpc: "2.0", id: 1, method, params }),
        {
          retries: 4,
          factor: 2,
          minTimeout: 250,
          maxTimeout: 2000,
          onFailedAttempt: async (e) => {
            await sleep(50 + Math.floor(Math.random() * 75));
          },
          retry: (e) => e?.retryable === true,
        }
      )
    );
  }

  return { call, limiter };
}

module.exports = { makeRpcClient };
