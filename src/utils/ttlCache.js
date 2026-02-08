class TTLCache {
  constructor({ ttlMs }) {
    this.ttlMs = ttlMs;
    this.map = new Map();
  }

  has(key) {
    const v = this.map.get(key);
    if (!v) return false;
    if (Date.now() - v > this.ttlMs) {
      this.map.delete(key);
      return false;
    }
    return true;
  }

  add(key) {
    this.map.set(key, Date.now());
  }

  cleanup() {
    const now = Date.now();
    for (const [k, t] of this.map.entries()) {
      if (now - t > this.ttlMs) this.map.delete(k);
    }
  }
}

module.exports = { TTLCache };
